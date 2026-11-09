// Recorded refunds, per order line. Server only.
//
// The money itself goes back to the buyer in Stripe (dashboard). This records it so the books match: one Refund row
// per recorded refund (prisma/schema.prisma). A line is refunded while it has a row with undoneAt null; undoing a
// refund stamps undoneAt on it. Recording and undoing also write an "order.refund" / "order.refund_undo" AdminAction
// (the audit log says who did what), but everything that computes money reads only Refund rows.
//
// The artist's share is reversed only when the line's payout month wasn't paid yet at refund time
// (reversed). A reversed line counts as 0 for the artist everywhere money is computed
// (lib/balance.ts, admin payouts summary, mark-paid, CSV). If the month was already paid, what happens depends on
// the owner's setting and the refund reason (lib/refundPolicy.ts):
//   - absorbed: the artist keeps that share and Artfinity absorbs the refund (the default; always for damaged prints).
//   - deducted: the line keeps its paid share, and a negative "Refund adjustment" of that share
//     is booked to the artist's next unpaid payout month at refund time (adjustMonth, lib/balance.ts
//     nextUnpaidMonth), so it lowers the very next payout. lib/balance.ts
//     adds it to that month's total; a month can't be paid below $0, so the rest carries forward.
// The pure rules live in lib/refundMath.ts.
import { prisma } from "@/lib/prisma";
import { isRefundReason, type RefundReason } from "@/lib/refundPolicy";
import { adjustmentsFrom, refundInfoFromRow, refundsByLine, totalsByArtist, type RefundAdjustment, type RefundInfo, type RefundRow } from "@/lib/refundMath";

export { orderRefOf, shareAfterRefund, type RefundAdjustment, type RefundInfo } from "@/lib/refundMath";

/** Audit-log actions (lib/audit.ts) written when an admin records or undoes a refund. Not read for money. */
export const REFUND_ACTION = "order.refund";
export const REFUND_UNDO_ACTION = "order.refund_undo";

const reasonOf = (raw: string): RefundReason => (isRefundReason(raw) ? raw : "other");

const REFUND_SELECT = {
  id: true, orderId: true, orderItemId: true, artistId: true, amountCents: true, shareCents: true, reversed: true,
  deducted: true, adjustMonth: true, reason: true, title: true, note: true, createdAt: true, createdByEmail: true,
} as const;

/** Every line that is refunded right now, by orderItemId. Optionally only these orders, or only one artist's lines. */
export async function activeRefunds(orderIds?: string[], opts: { artistId?: string } = {}): Promise<Map<string, RefundInfo>> {
  if (orderIds && !orderIds.length) return new Map();
  const rows: RefundRow[] = await prisma.refund.findMany({
    where: {
      undoneAt: null,
      ...(orderIds ? { orderId: { in: orderIds } } : {}),
      ...(opts.artistId ? { artistId: opts.artistId } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: REFUND_SELECT,
  });
  return refundsByLine(rows, reasonOf);
}

export type NewRefund = {
  orderId: string;
  orderItemId: string;
  artistId: string | null;
  amountCents: number;
  shareCents: number;
  reversed: boolean;
  deducted: boolean;
  adjustMonth: string | null;
  reason: RefundReason;
  title: string;
  note: string;
  /** The admin who recorded it. */
  createdByEmail: string;
};

/** Records a refund on one line. The caller checks the line isn't refunded already, and writes the audit row. */
export async function recordRefund(r: NewRefund): Promise<RefundInfo> {
  const deducted = r.deducted && !r.reversed;
  const row = await prisma.refund.create({
    data: {
      orderId: r.orderId,
      orderItemId: r.orderItemId,
      artistId: r.artistId,
      amountCents: Math.round(r.amountCents) || 0,
      shareCents: Math.round(r.shareCents) || 0,
      reversed: r.reversed,
      deducted,
      adjustMonth: deducted ? r.adjustMonth : null,
      reason: reasonOf(r.reason),
      title: r.title,
      note: r.note,
      createdByEmail: r.createdByEmail,
    },
    select: REFUND_SELECT,
  });
  return refundInfoFromRow(row, reasonOf(row.reason));
}

/** Cancels the refund on a line: every live row for it is marked undone. Returns how many rows that was. */
export async function undoRefund(orderItemId: string, undoneByEmail: string, now = new Date()): Promise<number> {
  const { count } = await prisma.refund.updateMany({ where: { orderItemId, undoneAt: null }, data: { undoneAt: now, undoneByEmail } });
  return count;
}

/** Every live Refund adjustment, oldest first. Optionally one artist's, or one month's. */
export async function refundAdjustments(opts: { artistId?: string; month?: string } = {}): Promise<RefundAdjustment[]> {
  const refunds = await activeRefunds(undefined, { artistId: opts.artistId });
  return adjustmentsFrom(refunds.values(), { month: opts.month });
}

/** Refund adjustments summed per artist (cents, ≤ 0), optionally for one month. */
export async function adjustmentTotals(opts: { month?: string } = {}): Promise<Map<string, number>> {
  return totalsByArtist(await refundAdjustments(opts));
}
