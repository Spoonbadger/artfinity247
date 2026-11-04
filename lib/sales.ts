// lib/sales.ts
// One place to turn a stored OrderItem into money figures, so artist-facing
// views (my-sales, payouts) use the same math as the admin payout pages.
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue";

/** Normalize stored item.size ("small", "M", "xl", ...) to "S" | "M" | "L" | "XL". */
export function normalizeSize(raw: string | null | undefined): PrintSize {
  const v = (raw || "").toUpperCase();
  if (v.startsWith("S")) return "S";
  if (v.startsWith("XL")) return "XL";
  if (v.startsWith("L")) return "L";
  return "M";
}

/**
 * Authoritative per-item breakdown (cents). Uses the split stored on the item
 * (OrderItem.artistSplit, locked in at order time: 60% Free, higher on Infinity) when
 * present, else the split for the order date (50% before 2026-10-21, 60% after).
 */
export function itemBreakdown(item: {
  lineTotal: number | null;
  unitPrice?: number | null;
  quantity: number | null;
  size: string | null;
  frameChosen?: boolean | null;
  orderDate: Date;
  artistSplit?: number | null;
}) {
  const qty = item.quantity || 1;
  const lineTotal = item.lineTotal ?? (item.unitPrice ?? 0) * qty;
  const b = calcItemProfitCents({
    lineTotal,
    size: normalizeSize(item.size),
    frameChosen: !!item.frameChosen,
    quantity: qty,
    orderDate: item.orderDate,
    artistSplit: item.artistSplit,
  });
  return {
    lineTotal,
    quantity: qty,
    expenses: b.printCost + b.shippingCost + b.laborCost + b.websiteCost,
    profit: b.profit,
    artistShare: b.artistShare,
    companyShare: b.companyShare,
    split: b.split,
  };
}
