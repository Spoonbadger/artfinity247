// Admin alerts: one AdminAlert row per thing that needs an admin, keyed so the same issue is never raised or
// emailed twice. Server only. Stable API for other modules (crons, jobs, lib code):
//
//   raiseAlert({ kind, key, title, link, severity })   idempotent by key; never throws
//   resolveAlert(key)                                   when the matching admin action happens; never throws
//   resolveAlerts({ prefix }) / resolveAlerts([keys])
//   alertKey.<kind>(...)                                the key conventions
//
// Email: an alert goes out right away to every admin whose preference for its kind is "instant" (the default for
// urgent alerts), then emailedAt is set. Everything else waits for the daily digest (sendAdminDigest, run by
// /api/cron/admin-digest), which sets digestedAt. Preferences live on Artist.adminNotify ({ kind: pref }).
// Snoozes are AdminAction rows ("alert.snooze" with details.until), so no extra column is needed.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { asAdminRole, type AdminRole } from "@/lib/adminCaps";
import { effectivePref, kindMeta, parseNotifyPrefs, type AlertKind, type AlertSeverity, type NotifyPrefs } from "@/lib/alertKinds";

export type { AlertKind, AlertSeverity, NotifyPref } from "@/lib/alertKinds";
export { ALERT_KINDS, kindMeta } from "@/lib/alertKinds";

const FROM = "Artfinity <notifications@theartfinity.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const REEMAIL_AFTER_MS = 12 * 3_600_000;
const SEVERITY_RANK: Record<string, number> = { low: 0, normal: 1, urgent: 2 };
const abs = (link: string) => (/^https?:\/\//.test(link) ? link : `${APP_URL()}${link.startsWith("/") ? "" : "/"}${link}`);

/** Key conventions, so the place that raises and the place that resolves agree. */
export const alertKey = {
  report: (reportId: string) => `report:${reportId}`,
  reprint: (requestId: string) => `reprint:${requestId}`,
  duplicate: (artworkId: string) => `duplicate:${artworkId}`,
  moderation: (artworkId: string) => `moderation:${artworkId}`,
  reviewFlagged: (reviewId: string) => `review_flagged:${reviewId}`,
  /** One per request: a new request after a decline is a new alert. Resolve with { prefix: verificationPrefix(id) }. */
  verification: (artistId: string, requestedAt: Date) => `verification:${artistId}:${requestedAt.getTime()}`,
  verificationPrefix: (artistId: string) => `verification:${artistId}:`,
  workOrderFailed: (orderId: string) => `work_order_failed:${orderId}`,
  payoutFailed: (artistId: string, month: string) => `payout_failed:${artistId}:${month}`,
  payoutLate: (artistId: string, month: string) => `payout_late:${artistId}:${month}`,
  orderStuck: (orderId: string) => `order_stuck:${orderId}`,
  orderUndelivered: (orderId: string) => `order_undelivered:${orderId}`,
  /** One per job (lib/jobs/run.ts raises it on a failed run and resolves it on the next good one). */
  jobFailed: (job: string) => `job_failed:${job}`,
};

export type RaiseAlertInput = {
  kind: AlertKind | (string & {});
  key: string;
  title: string;
  /** Admin path (or full URL) where it's handled, e.g. "/admin/reports". */
  link?: string;
  severity?: AlertSeverity;
  /** false: never email right away, leave it to the digest (sweeps that backfill old items). Default true. */
  instant?: boolean;
  /**
   * If an alert with this key was resolved, open it again (the problem came back). Default true. A reopened alert
   * goes into the next digest again, and is emailed again only if its last email was 12+ hours ago.
   * Sweeps pass false so an admin's manual "resolve" sticks.
   */
  reopen?: boolean;
};

export type AlertAdmin = { id: string; email: string; name: string; role: AdminRole; prefs: NotifyPrefs };

/** Everyone on the admin team who can still log in. */
export async function alertAdmins(): Promise<AlertAdmin[]> {
  const rows = await prisma.artist.findMany({
    where: { role: "ADMIN", closedAt: null, suspendedAt: null },
    select: { id: true, email: true, first_name: true, name: true, adminRole: true, adminNotify: true },
  });
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.first_name || firstNameOf(r.name), role: asAdminRole(r.adminRole), prefs: parseNotifyPrefs(r.adminNotify) }));
}

/** Raise (or find) the alert for `key`. Idempotent and never throws: an alert must never break the action behind it. */
export async function raiseAlert(input: RaiseAlertInput): Promise<{ id: string; created: boolean; emailed: number } | null> {
  const key = String(input.key || "").slice(0, 190);
  if (!key) return null;
  const severity: AlertSeverity = input.severity === "urgent" || input.severity === "low" ? input.severity : "normal";
  const data = { kind: String(input.kind).slice(0, 60), key, title: String(input.title || "").replace(/\s+/g, " ").trim().slice(0, 200), link: input.link || kindMeta(String(input.kind)).queue, severity };
  try {
    let created = false;
    let row = await prisma.adminAlert.findUnique({ where: { key }, select: { id: true, resolvedAt: true, emailedAt: true, severity: true } });
    if (!row) {
      try {
        row = await prisma.adminAlert.create({ data, select: { id: true, resolvedAt: true, emailedAt: true, severity: true } });
        created = true;
      } catch (e) {
        // Someone raised the same key a moment ago.
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        row = await prisma.adminAlert.findUnique({ where: { key }, select: { id: true, resolvedAt: true, emailedAt: true, severity: true } });
        if (!row) return null;
      }
    } else if (!row.resolvedAt && SEVERITY_RANK[severity] > (SEVERITY_RANK[row.severity] ?? 1)) {
      // Escalated (e.g. a work order still failing after retries): an open alert takes the new severity and title,
      // and is emailed now if it hasn't been yet.
      await prisma.adminAlert.update({ where: { id: row.id }, data: { severity, title: data.title, link: data.link } });
    } else if (row.resolvedAt && input.reopen !== false) {
      const reEmail = !row.emailedAt || row.emailedAt.getTime() < Date.now() - REEMAIL_AFTER_MS;
      await prisma.adminAlert.update({
        where: { id: row.id },
        data: { resolvedAt: null, digestedAt: null, title: data.title, link: data.link, severity, ...(reEmail ? { emailedAt: null } : {}) },
      });
      row = { ...row, resolvedAt: null, emailedAt: reEmail ? null : row.emailedAt };
    }
    let emailed = 0;
    if (!row.resolvedAt && !row.emailedAt && input.instant !== false) emailed = await emailInstant(row.id, data);
    return { id: row.id, created, emailed };
  } catch (err) {
    console.error("ALERT_RAISE_FAIL", key, err);
    return null;
  }
}

async function emailInstant(id: string, a: { kind: string; title: string; link: string; severity: AlertSeverity }): Promise<number> {
  const to = (await alertAdmins()).filter((ad) => effectivePref(ad.prefs, a.kind, ad.role, a.severity) === "instant");
  if (!to.length) return 0;
  // Claim it first, so two raises at once can't both email.
  const { count } = await prisma.adminAlert.updateMany({ where: { id, emailedAt: null }, data: { emailedAt: new Date() } });
  if (count !== 1) return 0;
  const link = abs(a.link);
  const settings = abs("/admin/settings/notifications");
  let sent = 0;
  for (const ad of to) {
    const text = `Hi ${ad.name},\n\n${a.title}\n\n${link}\n\n${a.severity === "urgent" ? "This one is urgent. " : ""}You get these right away for ${kindMeta(a.kind).label.toLowerCase()}. Change it: ${settings}`;
    try {
      const { error } = await resend.emails.send({ from: FROM, to: ad.email, subject: `${a.severity === "urgent" ? "Urgent: " : ""}${a.title}`, text, html: emailHtml(text, "Artfinity admin alert") });
      if (error) throw error;
      sent++;
    } catch (err) {
      console.error("ALERT_EMAIL_FAIL", ad.email, err);
    }
  }
  return sent;
}

/** Mark the alert for `key` handled. Returns how many were open. Never throws. */
export async function resolveAlert(key: string): Promise<number> {
  return resolveAlerts([key]);
}

/** Resolve by exact keys, or every open alert whose key starts with `prefix`. Never throws. */
export async function resolveAlerts(which: string[] | { prefix: string }): Promise<number> {
  try {
    const where: Prisma.AdminAlertWhereInput = Array.isArray(which)
      ? { key: { in: which.filter(Boolean) } }
      : which.prefix ? { key: { startsWith: which.prefix } } : { id: "__none__" };
    const { count } = await prisma.adminAlert.updateMany({ where: { ...where, resolvedAt: null }, data: { resolvedAt: new Date() } });
    return count;
  } catch (err) {
    console.error("ALERT_RESOLVE_FAIL", which, err);
    return 0;
  }
}

// ---------- Snooze (kept in the audit log) ----------

export const SNOOZE_ACTION = "alert.snooze";
export const UNSNOOZE_ACTION = "alert.unsnooze";

/** alertId → snoozed until, for snoozes still running. */
export async function activeSnoozes(now = new Date()): Promise<Map<string, Date>> {
  const rows = await prisma.adminAction.findMany({
    where: { action: { in: [SNOOZE_ACTION, UNSNOOZE_ACTION] }, targetType: "alert", createdAt: { gte: new Date(now.getTime() - 31 * 86_400_000) } },
    orderBy: { createdAt: "asc" },
    select: { action: true, targetId: true, details: true },
  });
  const out = new Map<string, Date>();
  for (const r of rows) {
    if (!r.targetId) continue;
    if (r.action === UNSNOOZE_ACTION) { out.delete(r.targetId); continue; }
    const until = new Date(String((r.details as Record<string, unknown> | null)?.until ?? ""));
    if (!Number.isNaN(until.getTime())) out.set(r.targetId, until);
  }
  for (const [id, until] of Array.from(out)) if (until <= now) out.delete(id);
  return out;
}

/** Open alerts (newest first), without the snoozed ones unless asked. */
export async function openAlerts(opts: { includeSnoozed?: boolean; take?: number } = {}) {
  const now = new Date();
  const [rows, snoozed] = await Promise.all([
    prisma.adminAlert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: opts.take ?? 500 }),
    activeSnoozes(now),
  ]);
  return rows.filter((r) => opts.includeSnoozed || !snoozed.has(r.id)).map((r) => ({ ...r, snoozedUntil: snoozed.get(r.id) ?? null }));
}

/** For the bell in the admin header. */
export async function openAlertCount(): Promise<number> {
  try {
    const [ids, snoozed] = await Promise.all([prisma.adminAlert.findMany({ where: { resolvedAt: null }, select: { id: true } }), activeSnoozes()]);
    return ids.filter((r) => !snoozed.has(r.id)).length;
  } catch {
    return 0;
  }
}

// ---------- Daily digest ----------

export type DigestResult = { alerts: number; sent: { email: string; items: number }[]; skipped: string | null };

/**
 * One short email per admin with every open alert they haven't been emailed about, grouped by kind, plus what's
 * still open. Alerts are marked digested either way, so nothing goes out twice. Nothing new: no email.
 */
export async function sendAdminDigest(now = new Date()): Promise<DigestResult> {
  const open = await openAlerts();
  const fresh = open.filter((a) => !a.digestedAt).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  if (!fresh.length) return { alerts: 0, sent: [], skipped: "Nothing new since the last digest" };

  const admins = await alertAdmins();
  const sent: DigestResult["sent"] = [];
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });
  for (const ad of admins) {
    const mine = fresh.filter((a) => {
      const pref = effectivePref(ad.prefs, a.kind, ad.role, a.severity as AlertSeverity);
      return pref === "digest" || (pref === "instant" && !a.emailedAt);
    });
    if (!mine.length) continue;
    const text = digestText(ad.name, dateLabel, mine, open.filter((a) => effectivePref(ad.prefs, a.kind, ad.role, a.severity as AlertSeverity) !== "off"));
    try {
      const { error } = await resend.emails.send({
        from: FROM,
        to: ad.email,
        subject: `Artfinity admin: ${mine.length} new thing${mine.length === 1 ? "" : "s"} need${mine.length === 1 ? "s" : ""} you`,
        text,
        html: emailHtml(text, "Artfinity admin digest"),
      });
      if (error) throw error;
      sent.push({ email: ad.email, items: mine.length });
    } catch (err) {
      console.error("DIGEST_EMAIL_FAIL", ad.email, err);
    }
  }
  await prisma.adminAlert.updateMany({ where: { id: { in: fresh.map((a) => a.id) }, digestedAt: null }, data: { digestedAt: now } });
  return { alerts: fresh.length, sent, skipped: null };
}

type DigestAlert = { kind: string; title: string; link: string; severity: string };

function groupByKind<T extends { kind: string }>(rows: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.kind, [...(m.get(r.kind) ?? []), r]);
  return Array.from(m).sort((a, b) => b[1].length - a[1].length);
}

function digestText(name: string, dateLabel: string, fresh: DigestAlert[], open: DigestAlert[]) {
  const parts = [`Hi ${name},`, `Here's what came in since the last digest (${dateLabel}).`];
  for (const [kind, rows] of groupByKind(fresh)) {
    const meta = kindMeta(kind);
    const lines = rows.slice(0, 5).map((r) => `• ${r.severity === "urgent" ? "URGENT " : ""}${r.title}\n  ${abs(r.link)}`);
    if (rows.length > 5) lines.push(`• and ${rows.length - 5} more: ${abs(meta.queue)}`);
    parts.push(`${meta.label} (${rows.length})\n${lines.join("\n")}`);
  }
  const still = groupByKind(open).map(([kind, rows]) => `${rows.length} ${kindMeta(kind).plural}`);
  if (still.length) parts.push(`Needs attention right now: ${still.join(" · ")}\n${abs("/admin/alerts")}`);
  parts.push(`Choose what you get by email: ${abs("/admin/settings/notifications")}`);
  return parts.join("\n\n");
}
