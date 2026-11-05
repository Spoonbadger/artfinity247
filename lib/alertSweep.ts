// Keeps admin alerts in step with the "Needs attention" queues. Server only.
//   sweepAdminAlerts()  raises the time-based alerts (late payouts, orders stuck 24h before the printer, shipped 10+
//                       days without delivery, failed jobs), backfills an alert for anything else that's waiting
//                       without one, and resolves alerts whose problem is gone (handled outside the admin hooks).
// Run by /api/cron/admin-digest (before the digest) and /api/cron/sweep. Backfilled alerts never email right away
// (they go into the digest), and an admin's manual "resolve" is respected (reopen: false).
import { prisma } from "@/lib/prisma";
import { alertKey, raiseAlert, resolveAlerts, type RaiseAlertInput } from "@/lib/alerts";
import { duplicateAlert, moderationAlert, payoutFailedAlert, reportAlert, reprintAlert, reviewAlert, verificationAlert, workOrderAlert } from "@/lib/alertBuilders";
import { latePayouts, monthLabel } from "@/lib/balance";
import { listRequests } from "@/lib/reprints";
import { TRACKING_SUBJECT } from "@/lib/tracking";
import { DUPLICATE_PREFIX } from "@/lib/imageHash";
import { orderNumber } from "@/lib/printer";

const DAY = 86_400_000;
export const STUCK_AFTER_HOURS = 24;
export const UNDELIVERED_AFTER_DAYS = 10;

/** Kinds this sweep owns completely: an open alert of these kinds whose key isn't current gets resolved. */
const SWEPT_KINDS = ["report", "reprint", "duplicate", "moderation", "review_flagged", "verification", "work_order_failed", "payout_failed", "payout_late", "order_stuck", "order_undelivered"];

const nameOf = (a: { artist_name: string | null; name: string } | null | undefined) => (a ? a.artist_name || a.name : "an artist");
const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

export type SweepResult = { current: number; raised: number; resolved: number };

export async function sweepAdminAlerts(now = new Date()): Promise<SweepResult> {
  const want: RaiseAlertInput[] = [];

  // ---- Time-based ----
  const late = await latePayouts(now);
  if (late.length) {
    const artists = await prisma.artist.findMany({ where: { id: { in: Array.from(new Set(late.map((l) => l.artistId))) } }, select: { id: true, artist_name: true, name: true } });
    const byId = new Map(artists.map((a) => [a.id, a]));
    for (const l of late) {
      want.push({ kind: "payout_late", key: alertKey.payoutLate(l.artistId, l.month), title: `Late payout: ${nameOf(byId.get(l.artistId))} for ${monthLabel(l.month)}`, link: `/admin/artists/${l.artistId}`, severity: "normal" });
    }
  }

  const stuck = await prisma.order.findMany({
    where: { OR: [{ paymentStatus: "paid" }, { kind: "reprint" }], shippingStatus: "pending", sentToPrinter: false, printerSentAt: null, createdAt: { lt: new Date(now.getTime() - STUCK_AFTER_HOURS * 3_600_000) } },
    select: { id: true, createdAt: true, shippingName: true, kind: true },
    take: 500,
  });
  for (const o of stuck) {
    want.push({ kind: "order_stuck", key: alertKey.orderStuck(o.id), title: `${o.kind === "reprint" ? "Reprint" : "Order"} #${orderNumber(o.id)}${o.shippingName ? ` for ${o.shippingName}` : ""} not sent to the printer (since ${day(o.createdAt)})`, link: `/admin/orders/${o.id}`, severity: "normal" });
  }

  const shipped = await prisma.order.findMany({ where: { shippingStatus: "shipped" }, select: { id: true, createdAt: true, shippingName: true }, take: 2000 });
  if (shipped.length) {
    const msgs = await prisma.message.groupBy({ by: ["orderId"], where: { orderId: { in: shipped.map((o) => o.id) }, subject: { startsWith: TRACKING_SUBJECT } }, _min: { createdAt: true } });
    const shippedAt = new Map(msgs.map((m) => [m.orderId, m._min.createdAt]));
    for (const o of shipped) {
      const at = shippedAt.get(o.id) ?? o.createdAt;
      if (at.getTime() >= now.getTime() - UNDELIVERED_AFTER_DAYS * DAY) continue;
      want.push({ kind: "order_undelivered", key: alertKey.orderUndelivered(o.id), title: `Order #${orderNumber(o.id)}${o.shippingName ? ` for ${o.shippingName}` : ""} shipped ${day(at)}, not marked delivered`, link: `/admin/orders/${o.id}`, severity: "low" });
    }
  }

  // ---- Queues that also raise when they happen (backfill + resolve) ----
  const [reports, reprints, flaggedArt, pendingArt, reviews, verify, failedWo, failedPayouts] = await Promise.all([
    prisma.artReport.findMany({ where: { status: "open" }, select: { id: true, reason: true, artworkUrl: true, artwork: { select: { title: true } } } }),
    listRequests("open"),
    prisma.artwork.findMany({ where: { flaggedReason: { startsWith: DUPLICATE_PREFIX }, status: { not: "REJECTED" } }, select: { id: true, title: true, artist: { select: { artist_name: true, name: true } } } }),
    prisma.artwork.findMany({ where: { status: "PENDING", NOT: { flaggedReason: { startsWith: DUPLICATE_PREFIX } } }, select: { id: true, title: true, artist: { select: { artist_name: true, name: true } } } }),
    prisma.review.findMany({ where: { status: "flagged" }, select: { id: true, rating: true, buyerName: true } }),
    prisma.artist.findMany({ where: { verification: "PENDING" }, select: { id: true, artist_name: true, name: true, verificationRequestedAt: true, createdAt: true } }),
    prisma.order.findMany({ where: { printerRef: { startsWith: "failed" }, shippingStatus: "pending" }, select: { id: true, printerRef: true } }),
    prisma.payout.findMany({ where: { paidAt: null, failureReason: { not: null } }, select: { artistId: true, month: true, failureReason: true, artist: { select: { artist_name: true, name: true } } } }),
  ]);
  for (const r of reports) want.push(reportAlert(r));
  for (const r of reprints) want.push(reprintAlert(r.id, r.orderId));
  for (const a of flaggedArt) want.push(duplicateAlert(a.id, a.title, nameOf(a.artist)));
  for (const a of pendingArt) want.push(moderationAlert(a.id, a.title, nameOf(a.artist)));
  for (const r of reviews) want.push(reviewAlert(r.id, r.rating, r.buyerName));
  for (const a of verify) want.push(verificationAlert(a.id, nameOf(a), a.verificationRequestedAt ?? a.createdAt));
  for (const o of failedWo) want.push(workOrderAlert(o.id, (o.printerRef || "").replace(/^failed:\s*/, "")));
  for (const p of failedPayouts) want.push(payoutFailedAlert(p.artistId, nameOf(p.artist), p.month, p.failureReason || ""));

  let raised = 0;
  for (const w of want) {
    const r = await raiseAlert({ ...w, instant: w.kind === "payout_late" || w.kind === "order_stuck" || w.kind === "order_undelivered", reopen: false });
    if (r?.created) raised++;
  }

  // ---- Resolve what's no longer true ----
  const current = new Set(want.map((w) => w.key));
  const open = await prisma.adminAlert.findMany({ where: { resolvedAt: null, kind: { in: SWEPT_KINDS } }, select: { key: true } });
  const gone = open.map((a) => a.key).filter((k) => !current.has(k));
  let resolved = gone.length ? await resolveAlerts(gone) : 0;

  // Failed jobs: lib/jobs/run.ts raises and resolves these itself; this catches runs logged some other way.
  const failedRuns = await prisma.jobRun.findMany({ where: { ok: false, finishedAt: { not: null }, startedAt: { gte: new Date(now.getTime() - 3 * DAY) } }, orderBy: { startedAt: "desc" }, select: { job: true, summary: true, startedAt: true } });
  for (const run of failedRuns) {
    const later = await prisma.jobRun.findFirst({ where: { job: run.job, ok: true, startedAt: { gt: run.startedAt } }, select: { id: true } });
    if (later) { resolved += await resolveAlerts([alertKey.jobFailed(run.job)]); continue; }
    const r = await raiseAlert({ kind: "job_failed", key: alertKey.jobFailed(run.job), title: `Job "${run.job}" failed: ${run.summary}`, link: "/admin/alerts", severity: "normal", reopen: false });
    if (r?.created) raised++;
  }
  return { current: current.size, raised, resolved };
}
