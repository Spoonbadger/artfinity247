// What a sale pays, for UI. Mirrors lib/artwork_price.ts and lib/revenue.ts.
// Discounts lower the sale price, so the artist's and Artfinity's shares both shrink.
import { basePrices, framePrices } from "@/lib/artwork_price";
import { COSTS, getArtistSplit } from "@/lib/revenue";

export type SizeKey = keyof typeof basePrices; // small | medium | large | xl
export const SIZE_NAME: Record<SizeKey, string> = { small: "Small", medium: "Medium", large: "Large", xl: "XL" };
export const SIZE_INCHES: Record<SizeKey, string> = { small: "5 × 7 in", medium: "8 × 12 in", large: "11 × 17 in", xl: "18 × 24 in" };
const COST_KEY: Record<SizeKey, "S" | "M" | "L" | "XL"> = { small: "S", medium: "M", large: "L", xl: "XL" };

export function breakdown(size: SizeKey, markupCents = 0, discountPct = 0, framed = false, date = new Date()) {
  const list = basePrices[size] + markupCents + (framed ? framePrices[size] : 0);
  const price = Math.round(list * (1 - discountPct / 100));
  const cost = framed ? COSTS.ITEM.FRAMED[COST_KEY[size]] : COSTS.ITEM.UNFRAMED[COST_KEY[size]];
  const fee = Math.ceil(price * COSTS.STRIPE_PERCENT) + COSTS.STRIPE_FIXED;
  const hosting = COSTS.HOSTING_PER_ITEM;
  const profit = Math.max(0, price - cost - fee - hosting);
  const artist = Math.round(profit * getArtistSplit(date));
  return { list, price, cost, fee, hosting, profit, artist, company: profit - artist };
}

export const money = (cents: number) => "$" + (cents / 100).toFixed(2);
export const moneyRound = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");
