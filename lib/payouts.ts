// "Pay all ready payouts": the monthly run, from /admin/payouts or the cron (app/api/cron/payouts). Server only.
//
// What's ready is exactly what each artist's Money page calls their next payout (lib/balance.ts getBalance):
// every closed month that isn't paid yet, at that month's total. Each month is paid on its own:
//   - connected to Stripe and ready: one Stripe Transfer per month (idempotency key payout:<artistId>:<month>),
//     recorded as a Payout row with method "stripe", the transfer id and paidAt. Errors land in failureReason.
//   - not connected: left for the admin to pay by Venmo by hand and mark paid (the existing flow).
// The platform's Stripe balance has to cover the transfers (see the insufficient-funds message below).
// Refund adjustments (lib/refunds.ts) are already in each month's amount (PayoutRow.payableCents). A month they bring
// to $0 isn't sent; it's recorded as paid at $0 (method "carried") together with the month it carried into.
import { randomBytes } from "crypto";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { resend } from "@/lib/resend";
import { CARRIED_METHOD, carriedInto, getBalance, monthLabel, utcMonth } from "@/lib/balance";
import { SIM_TRANSFER, connectMode, connectStatus, stripeOrNull, type ConnectMode } from "@/lib/stripeConnect";
import PayoutSentEmail from "@/emails/PayoutSentEmail";
import { alertKey, raiseAlert, resolveAlerts } from "@/lib/alerts";
import { payoutFailedAlert } from "@/lib/alertBuilders";

const FROM = "Artfinity <notifications@theartfinity.com>";

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
  venmoHandle: string | null;
  route: "stripe" | "venmo";
  stripeAccountId: string | null;
  months: ReadyMonth[];
  totalCents: number;
};

/** Every artist with closed, unpaid months, and how they'd be paid. Biggest first. */
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
      select: { id: true, artist_name: true, name: true, email: true, venmoHandle: true, stripeAccountId: true, stripePayoutsEnabled: true },
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
    out.push({
      artistId: a.id,
      artistName: a.artist_name || a.name || a.email,
      email: a.email,
      venmoHandle: b.venmoHandle,
      route: connectStatus(a, mode) === "ready" ? "stripe" : "venmo",
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
  /** Not connected to Stripe: pay by Venmo by hand, then mark paid. */
  manual: ReadyArtist[];
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

/** Creates (or finds, on a retry days later) the Stripe Transfer for one artist-month. */
async function transferFor(stripe: Stripe, a: ReadyArtist, m: ReadyMonth): Promise<string> {
  const group = `payout_${a.artistId}_${m.month}`;
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
      description: `Artfinity payout for ${monthLabel(m.month)}`,
      metadata: { artistId: a.artistId, month: m.month },
    },
    { idempotencyKey: `payout:${a.artistId}:${m.month}` },
  );
  return t.id;
}

/**
 * Pays every ready Stripe payout. Venmo artists are only listed. Safe to run twice: paid months are skipped,
 * and a month's transfer is found again instead of sent twice.
 */
export async function payReadyPayouts(opts: { now?: Date; source: "admin" | "cron" }): Promise<PayRunResult> {
  const now = opts.now ?? new Date();
  const mode = connectMode();
  const ready = await readyPayouts(now);
  const result: PayRunResult = { mode, paid: [], failed: [], manual: ready.filter((r) => r.route === "venmo"), insufficientFunds: false };
  if (mode === "off") return result;
  const stripe = mode === "live" ? stripeOrNull() : null;

  for (const a of ready.filter((r) => r.route === "stripe")) {
    for (const m of a.months) {
      // Someone (or the other run) may have paid it a moment ago.
      const existing = await prisma.payout.findUnique({ where: { artistId_month: { artistId: a.artistId, month: m.month } }, select: { paidAt: true } });
      if (existing?.paidAt) continue;
      try {
        const transferId = stripe ? await transferFor(stripe, a, m) : `${SIM_TRANSFER}${randomBytes(8).toString("hex")}`;
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
