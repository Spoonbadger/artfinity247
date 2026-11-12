// Payout rules with no database: who gets paid in a run, who waits, what counts as late, when a reminder may go out,
// and how a paid month's method is labelled. Pure (no Prisma, no Stripe client), so lib/payoutPlan.test.mjs can run it.
//
// Artists are paid only through Stripe Connect (Express). An artist without a payout-ready Connect account is not
// paid by hand: their closed months stay in their balance ("held until you connect Stripe"), and the first run after
// they connect pays every closed, unpaid month, each as its own transfer (idempotency key payout:<artistId>:<month>).
import type Stripe from "stripe";
import type { ConnectStatus } from "@/lib/stripeConnect";

/**
 * BUSINESS DECISION: payout day. Artfinity sends each month's earnings by this day of the
 * following month (Sell with us and the artist terms both say "by the 5th of the following month").
 * The run on the 5th (cron, or "Pay all" in /admin/payouts) sends a Stripe transfer to each connected artist;
 * artists never start one.
 *
 * Note: with a 14-day window, orders from the last ~9 days of a month are still in the window on
 * the 5th. The admin pays whole months, so those sales ARE in that payout; they show as pending
 * until they clear and are reported in nextPayout.clearingCents.
 */
export const PAYOUT_DAY_OF_MONTH = 5;

/** A month's payout counts as late once it is still unpaid this many days after the 5th (connected artists only). */
export const LATE_AFTER_DAYS = 3;

const DAY_MS = 86_400_000;

/** The payout due date for an earnings month: the 5th of the following month, UTC. */
export function payoutDateFor(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, PAYOUT_DAY_OF_MONTH)); // m is 1-based, so this is next month
}

/** Unpaid and more than LATE_AFTER_DAYS days past the payout day (the whole 5th counts as on time). Date math only. */
export function isPayoutLate(month: string, now: Date = new Date()) {
  return now.getTime() >= payoutDateFor(month).getTime() + (1 + LATE_AFTER_DAYS) * DAY_MS;
}

/** The most recent payout day (the 5th, UTC) on or before `now`. */
export function lastPayoutDay(now: Date = new Date()): Date {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  return now.getUTCDate() >= PAYOUT_DAY_OF_MONTH ? new Date(Date.UTC(y, m, PAYOUT_DAY_OF_MONTH)) : new Date(Date.UTC(y, m - 1, PAYOUT_DAY_OF_MONTH));
}

/** The next payout run: the 5th of this month if it hasn't passed, else the 5th of next month (UTC). */
export function nextPayoutDay(now: Date = new Date()): Date {
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  return now.getUTCDate() <= PAYOUT_DAY_OF_MONTH ? new Date(Date.UTC(y, m, PAYOUT_DAY_OF_MONTH)) : new Date(Date.UTC(y, m + 1, PAYOUT_DAY_OF_MONTH));
}

// ---------- Who is paid ----------

/** "stripe": paid in the run. "held": kept in their balance until their Connect account is payout-ready. */
export type PayoutRoute = "stripe" | "held";
export const payoutRoute = (status: ConnectStatus): PayoutRoute => (status === "ready" ? "stripe" : "held");

export type PlanMonth = { month: string; amountCents: number };
export type PlanArtist<M extends PlanMonth = PlanMonth> = { artistId: string; status: ConnectStatus; months: M[] };

/**
 * Splits a run: payout-ready artists get one transfer per closed, unpaid month (oldest first, $0 months skipped);
 * everyone else is held with the same months, to be paid on the first run after they connect.
 */
export function planRun<A extends PlanArtist>(artists: A[]) {
  type M = A["months"][number];
  const pay: { artist: A; month: M; idempotencyKey: string }[] = [];
  const held: { artist: A; months: M[]; totalCents: number }[] = [];
  for (const a of artists) {
    const months = a.months.filter((m) => m.amountCents > 0).sort((x, y) => x.month.localeCompare(y.month));
    if (!months.length) continue;
    if (payoutRoute(a.status) === "stripe") for (const m of months) pay.push({ artist: a, month: m, idempotencyKey: transferKey(a.artistId, m.month) });
    else held.push({ artist: a, months, totalCents: months.reduce((n, m) => n + m.amountCents, 0) });
  }
  return { pay, held };
}

/** Stripe idempotency key for one artist-month (unchanged from the first Connect release). */
export const transferKey = (artistId: string, month: string) => `payout:${artistId}:${month}`;
/** Stripe transfer_group for one artist-month, used to find an earlier transfer after the 24h idempotency window. */
export const transferGroup = (artistId: string, month: string) => `payout_${artistId}_${month}`;

export type TransferTarget = { artistId: string; stripeAccountId: string | null };

/** Creates (or finds, on a retry days later) the Stripe Transfer for one artist-month. Returns the transfer id. */
export async function transferFor(
  stripe: Pick<Stripe, "transfers">,
  a: TransferTarget,
  m: PlanMonth,
  description: string,
): Promise<string> {
  const group = transferGroup(a.artistId, m.month);
  // Idempotency keys only last 24 hours: look for an earlier transfer for this month first.
  const earlier = await stripe.transfers.list({ transfer_group: group, limit: 5 });
  const live = earlier.data.find((t) => !t.reversed && t.destination === a.stripeAccountId);
  if (live) return live.id;
  const t = await stripe.transfers.create(
    {
      amount: m.amountCents,
      currency: "usd",
      destination: a.stripeAccountId!,
      transfer_group: group,
      description,
      metadata: { artistId: a.artistId, month: m.month },
    },
    { idempotencyKey: transferKey(a.artistId, m.month) },
  );
  return t.id;
}

// ---------- Late ----------

/**
 * Is an unpaid, owed month late? Only for an artist whose Connect account is payout-ready, and only when the run
 * should have paid it: more than LATE_AFTER_DAYS past its payout day, and the artist wasn't held at the latest run
 * (heldAt: when a run last held them because Stripe wasn't ready). A balance waiting on the artist's own Stripe setup
 * is never late; a connected artist whose transfer failed or never ran is.
 */
export function isMonthLate(args: { month: string; status: ConnectStatus; now: Date; heldAt?: Date | null }) {
  if (args.status !== "ready" || !isPayoutLate(args.month, args.now)) return false;
  // Held at the latest payout run: they connected after it, so the next run pays them. Not late yet.
  return !(args.heldAt && args.heldAt.getTime() >= lastPayoutDay(args.now).getTime());
}

// ---------- Reminders ----------

/** "Connect Stripe to get paid" emails: at most one per artist per this many days (admin button and monthly email). */
export const REMINDER_EVERY_DAYS = 7;

/** Whether a reminder may go out now, given when the last one went (AdminAction "payout.reminder"). */
export function reminderStatus(lastSentAt: Date | null | undefined, now: Date = new Date()): { allowed: boolean; nextAt: Date | null } {
  if (!lastSentAt) return { allowed: true, nextAt: null };
  const nextAt = new Date(lastSentAt.getTime() + REMINDER_EVERY_DAYS * DAY_MS);
  return now.getTime() >= nextAt.getTime() ? { allowed: true, nextAt: null } : { allowed: false, nextAt };
}

/** Whole days since a date (0 on the day itself). */
export const daysSince = (d: Date, now: Date = new Date()) => Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY_MS));

// ---------- Labels ----------

export const STRIPE_LABEL = "Bank via Stripe";
/** Payout.method of a $0 month settled along with a later one, because a refund adjustment used it up (carriedInto). */
export const CARRIED_METHOD = "carried";
/** Rows from before Stripe-only payouts (method "venmo", "manual" or none). Kept for history, labelled neutrally. */
export const LEGACY_PAID_LABEL = "Paid outside Stripe (before Nov 2026)";
/** What an unpaid month shows while the artist's Stripe isn't payout-ready. */
export const HELD_LABEL = "Held until you connect Stripe";

/** A paid month's method, from Payout.method. Old by-hand rows ("venmo", "manual", or none) read as LEGACY_PAID_LABEL. */
export function paidMethodLabel(method: string | null | undefined) {
  if (method === "stripe") return STRIPE_LABEL;
  if (method === CARRIED_METHOD) return "Went to a refund adjustment";
  return LEGACY_PAID_LABEL;
}

/** Short form for tables and CSVs: "stripe", "carried" or "outside_stripe". */
export function paidMethodCode(method: string | null | undefined) {
  if (method === "stripe" || method === CARRIED_METHOD) return method;
  return "outside_stripe";
}
