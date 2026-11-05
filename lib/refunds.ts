// Recorded refunds, per order line. Server only.
//
// The money itself goes back to the buyer in Stripe (dashboard). This records it so the books match:
// the ledger is the admin audit log. An "order.refund" AdminAction (details.orderItemId) refunds a line,
// a later "order.refund_undo" for the same line cancels it; the newest row per line wins.
//
// The artist's share is reversed only when the line's payout month wasn't paid yet at refund time
// (details.reversed). A reversed line counts as 0 for the artist everywhere money is computed
// (lib/balance.ts, admin payouts summary, mark-paid, CSV). If the month was already paid, the artist keeps
// that share and Artfinity absorbs the refund (settle it by hand if needed).
import { prisma } from "@/lib/prisma";

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
  note: string;
};

type Details = { orderItemId?: unknown; amountCents?: unknown; shareCents?: unknown; reversed?: unknown; note?: unknown };

/** Every line that is refunded right now, by orderItemId. Optionally only these orders. */
export async function activeRefunds(orderIds?: string[]): Promise<Map<string, RefundInfo>> {
  if (orderIds && !orderIds.length) return new Map();
  const rows = await prisma.adminAction.findMany({
    where: { action: { in: [REFUND_ACTION, REFUND_UNDO_ACTION] }, targetType: "order", ...(orderIds ? { targetId: { in: orderIds } } : {}) },
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
      note: typeof d.note === "string" ? d.note : "",
    });
  }
  return out;
}

/** The artist's share after any refund: 0 when the refund reversed it. */
export const shareAfterRefund = (shareCents: number, r: RefundInfo | undefined) => (r?.reversed ? 0 : shareCents);
