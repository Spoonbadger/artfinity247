// Recorded refunds, per order line. Server only.
//
// The money itself goes back to the buyer in Stripe (dashboard). This records it so the books match:
// the ledger is the admin audit log. An "order.refund" AdminAction (details.orderItemId) refunds a line,
// a later "order.refund_undo" for the same line cancels it; the newest row per line wins.
//
// The artist's share is reversed only when the line's payout month wasn't paid yet at refund time
// (details.reversed). A reversed line counts as 0 for the artist everywhere money is computed
// (lib/balance.ts, admin payouts summary, mark-paid, CSV). If the month was already paid, what happens depends on
// the owner's setting and the refund reason (lib/refundPolicy.ts):
//   - absorbed: the artist keeps that share and Artfinity absorbs the refund (the default; always for damaged prints).
//   - deducted (details.deducted): the line keeps its paid share, and a negative "Refund adjustment" of that share
//     is booked to the refund's UTC month (details.adjustMonth), lowering the artist's next payout. lib/balance.ts
//     adds it to that month's total; a month can't be paid below $0, so the rest carries forward.
import { prisma } from "@/lib/prisma";
import { isRefundReason, type RefundReason } from "@/lib/refundPolicy";

export const REFUND_ACTION = "order.refund";
export const REFUND_UNDO_ACTION = "order.refund_undo";

export type RefundInfo = {
  orderItemId: string;
  orderId: string;
  actionId: string;
  at: Date;
  adminEmail: string;
  /** Line total refunded to the buyer, cents (ex-tax). */
  amountCents: number;
  /** Artist share on the line at refund time, cents. */
  shareCents: number;
  /** True when the artist's share was taken back (its payout month was still unpaid). */
  reversed: boolean;
  /** True when it was already paid out and the share comes off a later payout (a Refund adjustment). */
  deducted: boolean;
  /** UTC month the Refund adjustment is booked to ("YYYY-MM"); only when deducted. */
  adjustMonth: string | null;
  artistId: string | null;
  /** Older refunds have none ("other"). */
  reason: RefundReason;
  title: string;
  note: string;
};

type Details = {
  orderItemId?: unknown; amountCents?: unknown; shareCents?: unknown; reversed?: unknown; deducted?: unknown; adjustMonth?: unknown;
  artistId?: unknown; reason?: unknown; title?: unknown; note?: unknown;
};

/** Every line that is refunded right now, by orderItemId. Optionally only these orders. */
export async function activeRefunds(orderIds?: string[], opts: { artistId?: string } = {}): Promise<Map<string, RefundInfo>> {
  if (orderIds && !orderIds.length) return new Map();
  const rows = await prisma.adminAction.findMany({
    where: {
      action: { in: [REFUND_ACTION, REFUND_UNDO_ACTION] }, targetType: "order",
      ...(orderIds ? { targetId: { in: orderIds } } : {}),
      // Refund and undo rows both carry details.artistId.
      ...(opts.artistId ? { details: { path: ["artistId"], equals: opts.artistId } } : {}),
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, targetId: true, details: true, createdAt: true, adminEmail: true },
  });
  const out = new Map<string, RefundInfo>();
  for (const r of rows) {
    const d = (r.details ?? {}) as Details;
    const itemId = typeof d.orderItemId === "string" ? d.orderItemId : null;
    if (!itemId || !r.targetId) continue;
    if (r.action === REFUND_UNDO_ACTION) {
      out.delete(itemId);
      continue;
    }
    out.set(itemId, {
      orderItemId: itemId,
      orderId: r.targetId,
      actionId: r.id,
      at: r.createdAt,
      adminEmail: r.adminEmail,
      amountCents: Number(d.amountCents) || 0,
      shareCents: Number(d.shareCents) || 0,
      reversed: d.reversed === true,
      deducted: d.deducted === true && d.reversed !== true,
      adjustMonth: d.deducted === true && typeof d.adjustMonth === "string" ? d.adjustMonth : null,
      artistId: typeof d.artistId === "string" ? d.artistId : null,
      reason: isRefundReason(d.reason) ? d.reason : "other",
      title: typeof d.title === "string" ? d.title : "",
      note: typeof d.note === "string" ? d.note : "",
    });
  }
  return out;
}

/** A paid-out refund taken off a later payout. cents is negative. */
export type RefundAdjustment = {
  id: string;
  artistId: string;
  orderId: string;
  /** Order number as shown everywhere (lib/printer.ts orderNumber). */
  orderRef: string;
  orderItemId: string;
  title: string;
  /** UTC month it lowers ("YYYY-MM"): the month the refund was recorded. */
  month: string;
  cents: number;
  at: Date;
  reason: RefundReason;
};

export const orderRefOf = (orderId: string) => orderId.slice(-8).toUpperCase();

/** Every live Refund adjustment, oldest first. Optionally one artist's, or one month's. */
export async function refundAdjustments(opts: { artistId?: string; month?: string } = {}): Promise<RefundAdjustment[]> {
  const refunds = await activeRefunds(undefined, { artistId: opts.artistId });
  const out: RefundAdjustment[] = [];
  for (const r of Array.from(refunds.values())) {
    if (!r.deducted || !r.adjustMonth || !r.artistId || r.shareCents <= 0) continue;
    if (opts.month && r.adjustMonth !== opts.month) continue;
    out.push({
      id: r.actionId, artistId: r.artistId, orderId: r.orderId, orderRef: orderRefOf(r.orderId), orderItemId: r.orderItemId,
      title: r.title || "Print", month: r.adjustMonth, cents: -r.shareCents, at: r.at, reason: r.reason,
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Refund adjustments summed per artist (cents, ≤ 0), optionally for one month. */
export async function adjustmentTotals(opts: { month?: string } = {}): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const a of await refundAdjustments(opts)) out.set(a.artistId, (out.get(a.artistId) || 0) + a.cents);
  return out;
}

/** The artist's share after any refund: 0 when the refund reversed it. */
export const shareAfterRefund = (shareCents: number, r: RefundInfo | undefined) => (r?.reversed ? 0 : shareCents);
