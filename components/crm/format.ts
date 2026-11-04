// Client-safe formatting helpers for the customer tools.
export const TZ = "America/New_York";

export const usd = (cents: number) =>
  "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const usdShort = (cents: number) =>
  "$" + Math.round(cents / 100).toLocaleString("en-US");

export function shortDate(d: string | Date, withYear = false) {
  return new Date(d).toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric", ...(withYear ? { year: "numeric" } : {}) });
}

export function ago(d: string | Date, now = Date.now()) {
  const days = Math.floor((now - new Date(d).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} wk ago`;
  return shortDate(d, true);
}

export type Stage = "paid" | "printing" | "shipped" | "delivered";

export const STAGE_META: Record<Stage, { label: string; dab: string }> = {
  paid: { label: "Paid", dab: "#ffd43b" },
  printing: { label: "At the printer", dab: "#e8743b" },
  shipped: { label: "Shipped", dab: "#2b37f0" },
  delivered: { label: "Delivered", dab: "#15161b" },
};

export const STAGE_ORDER: Stage[] = ["paid", "printing", "shipped", "delivered"];

export const SIZE_TEXT: Record<string, string> = { S: "Small 5 × 7", M: "Medium 8 × 12", L: "Large 11 × 17", XL: "XL 18 × 24" };

/** Initial-letter swatch colors, picked from the name so each buyer keeps theirs. */
const PIGMENTS = ["#e8743b", "#2b37f0", "#ffd43b", "#5bc0be", "#c98a5a", "#7b2d8e", "#ff5a36"];
export function pigmentFor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PIGMENTS[h % PIGMENTS.length];
}
