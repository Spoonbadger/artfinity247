// The pure part of refunds (no database): turning Refund rows into what the money code reads.
// lib/refunds.ts loads the rows; lib/refundMath.test.mjs checks the rules.
import type { RefundReason } from "@/lib/refundPolicy";

/** A Refund row as lib/refunds.ts selects it (prisma/schema.prisma model Refund). */
export type RefundRow = {
  id: string;
  orderId: string;
  orderItemId: string;
  artistId: string | null;
  amountCents: number;
  shareCents: number;
  reversed: boolean;
  deducted: boolean;
  adjustMonth: string | null;
  reason: string;
  title: string;
  note: string;
  createdAt: Date;
  createdByEmail: string;
};

export type RefundInfo = {
  orderItemId: string;
  orderId: string;
  /** The Refund row's id. */
  id: string;
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

/** One Refund row as the money code reads it. A reversed refund is never also a deduction. */
export function refundInfoFromRow(r: RefundRow, reason: RefundReason): RefundInfo {
  const deducted = r.deducted && !r.reversed;
  return {
    orderItemId: r.orderItemId,
    orderId: r.orderId,
    id: r.id,
    at: r.createdAt,
    adminEmail: r.createdByEmail,
    amountCents: r.amountCents || 0,
    shareCents: r.shareCents || 0,
    reversed: r.reversed,
    deducted,
    adjustMonth: deducted ? r.adjustMonth : null,
    artistId: r.artistId,
    reason,
    title: r.title || "",
    note: r.note || "",
  };
}

/** Live refunds by orderItemId. Rows must be live (undoneAt null) and oldest first: the newest row per line wins. */
export function refundsByLine(rows: RefundRow[], reasonOf: (raw: string) => RefundReason): Map<string, RefundInfo> {
  const out = new Map<string, RefundInfo>();
  for (const r of rows) out.set(r.orderItemId, refundInfoFromRow(r, reasonOf(r.reason)));
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
  /** Payout month it lowers ("YYYY-MM"): the artist's next unpaid month when the refund was recorded. */
  month: string;
  cents: number;
  at: Date;
  reason: RefundReason;
};

export const orderRefOf = (orderId: string) => orderId.slice(-8).toUpperCase();

/** The Refund adjustments among these live refunds, oldest first. Optionally one month's. */
export function adjustmentsFrom(refunds: Iterable<RefundInfo>, opts: { month?: string } = {}): RefundAdjustment[] {
  const out: RefundAdjustment[] = [];
  for (const r of Array.from(refunds)) {
    if (!r.deducted || !r.adjustMonth || !r.artistId || r.shareCents <= 0) continue;
    if (opts.month && r.adjustMonth !== opts.month) continue;
    out.push({
      id: r.id, artistId: r.artistId, orderId: r.orderId, orderRef: orderRefOf(r.orderId), orderItemId: r.orderItemId,
      title: r.title || "Print", month: r.adjustMonth, cents: -r.shareCents, at: r.at, reason: r.reason,
    });
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Refund adjustments summed per artist (cents, ≤ 0). */
export function totalsByArtist(adjustments: RefundAdjustment[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const a of adjustments) out.set(a.artistId, (out.get(a.artistId) || 0) + a.cents);
  return out;
}

/** The artist's share after any refund: 0 when the refund reversed it. */
export const shareAfterRefund = (shareCents: number, r: RefundInfo | undefined) => (r?.reversed ? 0 : shareCents);
