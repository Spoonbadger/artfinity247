// "Pay all ready payouts": the monthly run, from /admin/payouts or the cron (app/api/cron/payouts). Server only.
//
// Artists are paid only through Stripe Connect (Express). What's owed is exactly what each artist's Money page calls
// their next payout (lib/balance.ts getBalance): every closed month that isn't paid yet, at that month's total.
//   - payout-ready Connect account: one Stripe Transfer per month (idempotency key payout:<artistId>:<month>),
//     recorded as a Payout row with method "stripe", the transfer id and paidAt. Errors land in failureReason.
//   - not payout-ready (never connected, or Stripe setup unfinished or paused): HELD. Nothing is sent and nothing is
//     written to the Payout table; the months stay in the artist's balance. The run notes who it held
//     (AdminAction "payout.held", so their months don't read as late before the next run), and the first run after
//     they connect pays every closed, unpaid month, each as its own transfer with its own idempotency key.
// There is no by-hand payout. Old Payout rows paid outside Stripe stay for history (lib/payoutPlan.ts labels them).
// The platform's Stripe balance has to cover the transfers (see the insufficient-funds message below).
// Refund adjustments (lib/refunds.ts) are already in each month's amount (PayoutRow.payableCents). A month they bring
// to $0 isn't sent; it's recorded as paid at $0 (method "carried") together with the month it carried into.
// The rules themselves (who's paid, late, reminders) are pure and tested: lib/payoutPlan.ts.
import { randomBytes } from "crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { CARRIED_METHOD, HELD_RUN_ACTION, carriedInto, getBalance, monthLabel, utcMonth } from "@/lib/balance";
import { SIM_TRANSFER, connectMode, connectStatus, stripeOrNull, type ConnectMode, type ConnectStatus } from "@/lib/stripeConnect";
import { PAYOUT_DAY_OF_MONTH, daysSince, payoutDateFor, payoutRoute, planRun, reminderStatus, transferFor, type PayoutRoute } from "@/lib/payoutPlan";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { logAdminAction, type AuditAdmin } from "@/lib/audit";
import PayoutSentEmail from "@/emails/PayoutSentEmail";
import { alertKey, raiseAlert, resolveAlerts } from "@/lib/alerts";
import { payoutFailedAlert } from "@/lib/alertBuilders";

const FROM = "Artfinity <notifications@theartfinity.com>";
const APP_URL = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
/** Who the payouts job is in the audit log when no admin pressed the button. */
const SYSTEM: AuditAdmin = { id: "system", email: "payouts job" };

export type ReadyMonth = {
  month: string;
  amountCents: number;
  failureReason: string | null;
  /** Earlier $0 months settled along with this one (a refund adjustment carried through them). */
  settles?: string[];
  /** Refund adjustments in this payout (this month's plus what carried in), cents ≤ 0. */
  adjustmentCents?: number;
};
export type ReadyArtist = {
  artistId: string;
  artistName: string;
  email: string;
  /** "stripe": paid in the run. "held": waits until their Connect account is payout-ready. */
  route: PayoutRoute;
  stripeStatus: ConnectStatus;
  stripeAccountId: string | null;
  months: ReadyMonth[];
  totalCents: number;
};

/** Every artist with closed, unpaid months, and whether the run pays them or holds them. Biggest first. */
export async function readyPayouts(now: Date = new Date()): Promise<ReadyArtist[]> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await prisma.$queryRaw<{ artistId: string; month: string }[]>`
    SELECT DISTINCT a."artistId" AS "artistId", to_char(o."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS month
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    JOIN "Artwork" a ON a.id = oi."artworkId"
    WHERE o."paymentStatus" = 'paid' AND o.kind <> 'bulk' AND o."createdAt" < ${monthStart}`;
  if (!rows.length) return [];
  const paid = await prisma.payout.findMany({
    where: { artistId: { in: Array.from(new Set(rows.map((r) => r.artistId))) }, paidAt: { not: null } },
    select: { artistId: true, month: true },
  });
  const done = new Set(paid.map((p) => `${p.artistId}:${p.month}`));
  const ids = Array.from(new Set(rows.filter((r) => !done.has(`${r.artistId}:${r.month}`)).map((r) => r.artistId)));
  if (!ids.length) return [];

  const [artists, failures] = await Promise.all([
    prisma.artist.findMany({
      where: { id: { in: ids } },
      select: { id: true, artist_name: true, name: true, email: true, stripeAccountId: true, stripePayoutsEnabled: true },
    }),
    prisma.payout.findMany({ where: { artistId: { in: ids }, paidAt: null, failureReason: { not: null } }, select: { artistId: true, month: true, failureReason: true } }),
  ]);
  const failedBy = new Map(failures.map((f) => [`${f.artistId}:${f.month}`, f.failureReason]));
  const mode = connectMode();

  const out: ReadyArtist[] = [];
  for (const a of artists) {
    // The same numbers the artist sees: lib/balance.ts, closed unpaid months only.
    const b = await getBalance(a.id, now);
    if (b.nextPayout.projected) continue;
    const owed = new Set(b.nextPayout.months);
    const months = b.payouts
      .filter((p) => owed.has(p.month) && p.status === "scheduled" && p.payableCents > 0)
      .map((p) => ({
        month: p.month,
        amountCents: p.payableCents,
        failureReason: failedBy.get(`${a.id}:${p.month}`) ?? null,
        settles: carriedInto(b, p.month),
        adjustmentCents: p.adjustmentCents + p.carryInCents,
      }))
      .sort((x, y) => x.month.localeCompare(y.month));
    if (!months.length) continue;
    const stripeStatus = connectStatus(a, mode);
    out.push({
      artistId: a.id,
      artistName: a.artist_name || a.name || a.email,
      email: a.email,
      route: payoutRoute(stripeStatus),
      stripeStatus,
      stripeAccountId: a.stripeAccountId,
      months,
      totalCents: months.reduce((n, m) => n + m.amountCents, 0),
    });
  }
  return out.sort((x, y) => y.totalCents - x.totalCents);
}

export type PaidLine = { artistId: string; artistName: string; month: string; amountCents: number; transferId: string; simulated: boolean };
export type FailedLine = { artistId: string; artistName: string; month: string; amountCents: number; reason: string };
export type PayRunResult = {
  mode: ConnectMode;
  paid: PaidLine[];
  failed: FailedLine[];
  /** Stripe not payout-ready: held in their balance, paid on the first run after they connect. */
  held: ReadyArtist[];
  /** True when a transfer failed because the platform's Stripe balance was too low. */
  insufficientFunds: boolean;
};

export const INSUFFICIENT_FUNDS =
  "Your Stripe balance is too low for this transfer. Add funds in Stripe (Balance → Add to balance) or wait for recent sales to become available, then run Pay all again.";

function reasonFor(err: unknown): { reason: string; insufficient: boolean } {
  const e = err as Partial<Stripe.errors.StripeError> & { message?: string };
  if (e?.code === "balance_insufficient") return { reason: INSUFFICIENT_FUNDS, insufficient: true };
  if (e?.code === "account_invalid" || /capabilit|payouts? (are|is) (not )?enabled|cannot currently/i.test(e?.message || "")) {
    return { reason: `Their Stripe account can't take transfers right now: ${e.message}`, insufficient: false };
  }
  return { reason: (e?.message || "Transfer failed").slice(0, 500), insufficient: false };
}

/**
 * Pays every payout-ready artist: one transfer per closed, unpaid month, including months held while they weren't
 * connected. Everyone else is held (returned in `held`, and noted in AdminAction so their months don't read as late).
 * Safe to run twice: paid months are skipped, and a month's transfer is found again instead of sent twice.
 * `by`: the admin who pressed Pay all (the cron passes nothing and is logged as the payouts job).
 */
export async function payReadyPayouts(opts: { now?: Date; source: "admin" | "cron"; by?: AuditAdmin | null }): Promise<PayRunResult> {
  const now = opts.now ?? new Date();
  const mode = connectMode();
  const ready = await readyPayouts(now);
  const plan = planRun(ready.map((a) => ({ ...a, status: a.stripeStatus })));
  const result: PayRunResult = { mode, paid: [], failed: [], held: plan.held.map((h) => h.artist), insufficientFunds: false };
  if (mode === "off") return result;
  const stripe = mode === "live" ? stripeOrNull() : null;

  if (result.held.length) {
    const total = result.held.reduce((n, a) => n + a.totalCents, 0);
    await logAdminAction(opts.by ?? SYSTEM, HELD_RUN_ACTION, { type: "payout" }, `Held ${result.held.length} ${result.held.length === 1 ? "artist" : "artists"} ($${(total / 100).toFixed(2)}): Stripe not set up`, {
      source: opts.source,
      artistIds: result.held.map((a) => a.artistId),
      held: result.held.map((a) => ({ artistId: a.artistId, months: a.months.map((m) => m.month), cents: a.totalCents, stripe: a.stripeStatus })),
    });
  }

  for (const { artist: a, month: m } of plan.pay) {
    // Someone (or the other run) may have paid it a moment ago.
    const existing = await prisma.payout.findUnique({ where: { artistId_month: { artistId: a.artistId, month: m.month } }, select: { paidAt: true } });
    if (existing?.paidAt) continue;
    try {
      const transferId = stripe ? await transferFor(stripe, a, m, `Artfinity payout for ${monthLabel(m.month)}`) : `${SIM_TRANSFER}${randomBytes(8).toString("hex")}`;
      const data = { amountCents: m.amountCents, paidAt: new Date(), method: "stripe", stripeTransferId: transferId, failureReason: null };
      await prisma.payout.upsert({
        where: { artistId_month: { artistId: a.artistId, month: m.month } },
        update: data,
        create: { artistId: a.artistId, month: m.month, ...data },
      });
      await settleCarried(a.artistId, m.settles ?? [], data.paidAt);
      result.paid.push({ artistId: a.artistId, artistName: a.artistName, month: m.month, amountCents: m.amountCents, transferId, simulated: !stripe });
      await resolveAlerts([alertKey.payoutFailed(a.artistId, m.month), alertKey.payoutLate(a.artistId, m.month)]);
      if (!stripe) console.log(`[payouts:sim] ${a.artistName} ${m.month} $${(m.amountCents / 100).toFixed(2)} -> ${transferId}`);
      await resend.emails
        .send({
          from: FROM,
          to: a.email,
          subject: `Your Artfinity payout for ${monthLabel(m.month)} is on its way`,
          react: PayoutSentEmail({ artistName: a.artistName, month: monthLabel(m.month), amountCents: m.amountCents, via: "stripe" }),
        })
        .catch((err) => console.error("Payout email failed", a.artistId, err));
    } catch (err) {
      const { reason, insufficient } = reasonFor(err);
      if (insufficient) result.insufficientFunds = true;
      console.error(`[payouts:${opts.source}] transfer failed`, a.artistId, m.month, err);
      await prisma.payout.upsert({
        where: { artistId_month: { artistId: a.artistId, month: m.month } },
        update: { amountCents: m.amountCents, method: "stripe", failureReason: reason },
        create: { artistId: a.artistId, month: m.month, amountCents: m.amountCents, paidAt: null, method: "stripe", failureReason: reason },
      }).catch((e) => console.error("Couldn't record payout failure", e));
      result.failed.push({ artistId: a.artistId, artistName: a.artistName, month: m.month, amountCents: m.amountCents, reason });
      await raiseAlert(payoutFailedAlert(a.artistId, a.artistName, m.month, reason));
    }
  }
  return result;
}

/**
 * Records the $0 months a refund adjustment used up as paid, with the same paidAt as the month they carried into
 * (so unmarking that month can clear them too). See carriedInto in lib/balance.ts.
 */
export async function settleCarried(artistId: string, months: string[], paidAt: Date) {
  for (const month of months) {
    const data = { amountCents: 0, paidAt, method: CARRIED_METHOD, stripeTransferId: null, failureReason: null };
    await prisma.payout.upsert({ where: { artistId_month: { artistId, month } }, update: data, create: { artistId, month, ...data } });
    await resolveAlerts([alertKey.payoutFailed(artistId, month), alertKey.payoutLate(artistId, month)]);
  }
}

/** Undo settleCarried when the month they were settled with is unmarked. */
export async function unsettleCarried(artistId: string, paidAt: Date) {
  return prisma.payout.deleteMany({ where: { artistId, method: CARRIED_METHOD, paidAt } });
}

/** Month the cron pays for on the 5th, for logs. */
export const lastClosedMonth = (now: Date = new Date()) => utcMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)));

// ---------- Waiting on Stripe setup ----------

/** AdminAction for a "Connect Stripe to get paid" email (admin button or the monthly one). Rate limit: lib/payoutPlan.ts. */
export const REMINDER_ACTION = "payout.reminder";

export type WaitingArtist = {
  artistId: string;
  artistName: string;
  email: string;
  stripeStatus: ConnectStatus;
  /** Closed account: they can't open the Studio to connect, so no reminder goes out (reopen it first). */
  closed: boolean;
  heldCents: number;
  months: string[];
  /** When the oldest held month would have been paid (its 5th), ISO. */
  heldSince: string;
  daysHeld: number;
  lastReminderAt: string | null;
  /** Next time a reminder may go out (null: now). */
  nextReminderAt: string | null;
};

/** When each artist was last sent a reminder (AdminAction REMINDER_ACTION, targetId = artist id). */
async function lastReminders(artistIds: string[]): Promise<Map<string, Date>> {
  if (!artistIds.length) return new Map();
  const rows = await prisma.adminAction.groupBy({
    by: ["targetId"],
    where: { action: REMINDER_ACTION, targetType: "artist", targetId: { in: artistIds } },
    _max: { createdAt: true },
  });
  return new Map(rows.filter((r) => r.targetId && r._max.createdAt).map((r) => [r.targetId!, r._max.createdAt!]));
}

/** Artists whose closed months are held because their Stripe isn't payout-ready. Longest wait first. */
export async function waitingOnStripe(now: Date = new Date(), ready?: ReadyArtist[]): Promise<WaitingArtist[]> {
  const held = (ready ?? (await readyPayouts(now))).filter((a) => a.route === "held");
  const [sent, closed] = await Promise.all([
    lastReminders(held.map((a) => a.artistId)),
    held.length ? prisma.artist.findMany({ where: { id: { in: held.map((a) => a.artistId) }, closedAt: { not: null } }, select: { id: true } }) : [],
  ]);
  const closedIds = new Set(closed.map((c) => c.id));
  return held
    .map((a) => {
      const since = payoutDateFor(a.months[0].month);
      const last = sent.get(a.artistId) ?? null;
      const r = reminderStatus(last, now);
      return {
        artistId: a.artistId,
        artistName: a.artistName,
        email: a.email,
        stripeStatus: a.stripeStatus,
        closed: closedIds.has(a.artistId),
        heldCents: a.totalCents,
        months: a.months.map((m) => m.month),
        heldSince: since.toISOString(),
        daysHeld: daysSince(since, now),
        lastReminderAt: last?.toISOString() ?? null,
        nextReminderAt: r.nextAt?.toISOString() ?? null,
      };
    })
    .sort((x, y) => x.heldSince.localeCompare(y.heldSince) || y.heldCents - x.heldCents);
}

const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

/** The reminder email: what's held and one link to Studio → Money. Plain text plus the shared HTML wrapper. */
export function reminderEmail(a: { artistName: string; heldCents: number; stripeStatus: ConnectStatus }) {
  const link = `${APP_URL()}/studio/money#getpaid-h`;
  const step = a.stripeStatus === "pending" ? "Stripe still needs a few details from you. Finish setup here:" : "Connect Stripe here. It takes about 5 minutes:";
  const text = [
    `Hi ${firstNameOf(a.artistName)},`,
    `You have ${usd(a.heldCents)} in sales waiting for you on Artfinity. We pay artists through Stripe, straight to your bank.`,
    `${step}\n${link}`,
    `Once you're connected, it's paid by the ${ordinal(PAYOUT_DAY_OF_MONTH)} of the month.`,
    "Artfinity",
  ].join("\n\n");
  return { subject: `${usd(a.heldCents)} is waiting for you on Artfinity`, text, html: emailHtml(text, "Artfinity payouts") };
}

export type ReminderResult = { ok: true; sentAt: string } | { ok: false; reason: "rate_limited"; nextAt: string } | { ok: false; reason: "not_waiting" | "closed" | "email_failed" };

/**
 * Emails one artist a "Connect Stripe to get paid" reminder, at most once per REMINDER_EVERY_DAYS (admin button and
 * the monthly email share the limit). Logged in AdminAction as REMINDER_ACTION with the artist as target.
 */
export async function sendStripeReminder(artistId: string, opts: { by?: AuditAdmin | null; now?: Date; waiting?: WaitingArtist; source: "admin" | "cron" }): Promise<ReminderResult> {
  const now = opts.now ?? new Date();
  const w = opts.waiting ?? (await waitingOnStripe(now)).find((x) => x.artistId === artistId);
  if (!w) return { ok: false, reason: "not_waiting" };
  if (w.closed) return { ok: false, reason: "closed" };
  const last = (await lastReminders([artistId])).get(artistId) ?? null;
  const r = reminderStatus(last, now);
  if (!r.allowed) return { ok: false, reason: "rate_limited", nextAt: r.nextAt!.toISOString() };
  const mail = reminderEmail(w);
  const { error } = await resend.emails.send({ from: FROM, to: w.email, subject: mail.subject, text: mail.text, html: mail.html });
  if (error) return { ok: false, reason: "email_failed" };
  await logAdminAction(opts.by ?? SYSTEM, REMINDER_ACTION, { type: "artist", id: artistId }, `Stripe setup reminder (${usd(w.heldCents)} held, ${opts.source === "cron" ? "monthly" : "by hand"})`, {
    artistId,
    heldCents: w.heldCents,
    months: w.months,
    source: opts.source,
  });
  return { ok: true, sentAt: now.toISOString() };
}

/** After the monthly run: remind every held artist (skipping anyone reminded in the last REMINDER_EVERY_DAYS). */
export async function remindWaitingArtists(now: Date = new Date(), ready?: ReadyArtist[]) {
  const waiting = await waitingOnStripe(now, ready);
  const out = { sent: 0, skipped: 0, failed: 0 };
  for (const w of waiting) {
    const r = await sendStripeReminder(w.artistId, { now, waiting: w, source: "cron" });
    if (r.ok) out.sent++;
    else if (r.reason === "email_failed") out.failed++;
    else out.skipped++;
  }
  return out;
}
