// Bulk orders: an artist orders their own prints at cost, to sell in person (markets, shows).
// Client-safe (no DB). The server re-prices with the same functions; client numbers are ignored.
import { COSTS, type PrintSize } from "@/lib/revenue";

// ---- Business decisions (not final; the owner hasn't set these yet) ----
/** Flat handling fee added once per bulk order, in cents. */
export const BULK_HANDLING_FEE_CENTS = 500;
/** Volume discount on production cost, by total prints in the order. Highest tier that fits wins. */
export const BULK_TIERS: { min: number; pct: number }[] = [
  { min: 25, pct: 10 },
  { min: 10, pct: 5 },
];
// ---- Limits ----
export const BULK_MAX_PER_LINE = 200;
export const BULK_MAX_LINES = 20;

export const BULK_SIZES: PrintSize[] = ["S", "M", "L", "XL"];
export const BULK_SIZE_LABEL: Record<PrintSize, { name: string; inches: string }> = {
  S: { name: "Small", inches: "5×7" },
  M: { name: "Medium", inches: "8×12" },
  L: { name: "Large", inches: "11×17" },
  XL: { name: "XL", inches: "18×24" },
};
/** Pricing/checkout size keys used by the retail flow. */
export const BULK_SIZE_KEY: Record<PrintSize, "small" | "medium" | "large" | "xl"> = { S: "small", M: "medium", L: "large", XL: "xl" };

export const isBulkSize = (s: unknown): s is PrintSize => s === "S" || s === "M" || s === "L" || s === "XL";

/** Production cost of one print, before any volume discount. */
export const bulkUnitCost = (size: PrintSize, framed: boolean) => (framed ? COSTS.ITEM.FRAMED[size] : COSTS.ITEM.UNFRAMED[size]);

export function bulkTier(prints: number) {
  return BULK_TIERS.find((t) => prints >= t.min) ?? null;
}

/** The next tier up, and how many more prints reach it. */
export function nextBulkTier(prints: number) {
  const next = [...BULK_TIERS].sort((a, b) => a.min - b.min).find((t) => prints < t.min);
  return next ? { ...next, more: next.min - prints } : null;
}

export type BulkLineIn = { size: PrintSize; framed: boolean; quantity: number };

export function bulkQuote(lines: BulkLineIn[]) {
  const prints = lines.reduce((n, l) => n + l.quantity, 0);
  const tier = bulkTier(prints);
  const pct = tier?.pct ?? 0;
  const priced = lines.map((l) => {
    const unit = bulkUnitCost(l.size, l.framed);
    const unitAfter = Math.round((unit * (100 - pct)) / 100);
    return { unit, unitAfter, lineTotal: unitAfter * l.quantity };
  });
  const subtotal = lines.reduce((n, l, i) => n + priced[i].unit * l.quantity, 0);
  const production = priced.reduce((n, p) => n + p.lineTotal, 0);
  const handling = prints > 0 ? BULK_HANDLING_FEE_CENTS : 0;
  const total = production + handling;
  return {
    lines: priced,
    prints,
    discountPct: pct,
    subtotal,
    discount: subtotal - production,
    production,
    handling,
    total,
    /** Average all-in cost per print (production + share of handling). */
    perPrint: prints ? Math.round(total / prints) : 0,
  };
}

export type BulkQuote = ReturnType<typeof bulkQuote>;
