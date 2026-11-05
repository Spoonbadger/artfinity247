// Print queue and code print orders: words, paper and price maths. Pure and client-safe.
// Server code (database, PDFs, Stripe) lives in lib/printQueue.ts and lib/codePrints.ts.
import { FORMATS, type FormatKey } from "@/components/qr/card";

export const FORMAT_ORDER: FormatKey[] = ["label", "sticker", "tag", "poster"];
export const QUEUE_MAX_QTY = 500;
export const QUEUE_MAX_ITEMS = 200;

/** What to buy for each format, matching the sheet layouts in FORMATS (components/qr/card.ts). */
export const PAPER: Record<FormatKey, { buy: string; avery: string | null; note: string }> = {
  label: { buy: "Avery 8371 or 5371 business cards", avery: "8371 / 5371", note: "10 per sheet, 2 × 5, already perforated. Matte white cards scan best." },
  sticker: { buy: "Avery 22807 2 in round labels", avery: "22807", note: "12 per sheet, 3 × 4. Any 2 in round label sheet with 12 per page works." },
  tag: { buy: "Matte white cardstock, 65–110 lb, US Letter", avery: null, note: "12 per sheet. Cut on the crop marks, then punch the hole." },
  poster: { buy: "Matte cardstock or heavy paper, US Letter", avery: null, note: "One per sheet. A print shop can do 11 × 17 in from the same PDF." },
};

export const perSheet = (f: FormatKey) => FORMATS[f].sheet.cols * FORMATS[f].sheet.rows;
export const sheetsFor = (f: FormatKey, cards: number) => Math.ceil(cards / perSheet(f));

/** Plural card names: "3 wall labels". */
export function cardWords(f: FormatKey, n: number) {
  const one = FORMATS[f].name.toLowerCase();
  return `${n} ${n === 1 ? one : one + "s"}`;
}

// ---------------- mailed code orders ----------------
export const ORDER_STATUSES = ["pending", "paid", "printing", "shipped", "delivered", "canceled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const isOrderStatus = (v: unknown): v is OrderStatus => typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Not paid yet",
  paid: "Paid · in line to print",
  printing: "Printing",
  shipped: "Shipped",
  delivered: "Delivered",
  canceled: "Canceled",
};
export const STATUS_DAB: Record<OrderStatus, string> = {
  pending: "#b9bcc4", paid: "#2b37f0", printing: "#ffd43b", shipped: "#e8743b", delivered: "#0f7a55", canceled: "#b9bcc4",
};

/** Cost-based pricing, set by the owner at /admin/settings/code-prints. All cents. */
export type CodePrintPricing = {
  unit: Record<FormatKey, number>;
  shipping: number;
  handling: number;
  /** Infinity artists ship free. Off by default. */
  infinityFreeShipping: boolean;
};

/** Placeholders until Craig sets the real costs. */
export const PRICING_DEFAULTS: CodePrintPricing = {
  unit: { label: 60, sticker: 50, tag: 75, poster: 300 },
  shipping: 500,
  handling: 0,
  infinityFreeShipping: false,
};

export type QuoteLine = { format: FormatKey; qty: number; unit: number; total: number };
export type Quote = { lines: QuoteLine[]; cards: number; subtotal: number; shipping: number; handling: number; total: number; freeShipping: boolean };

export function quoteFor(counts: Partial<Record<FormatKey, number>>, p: CodePrintPricing, opts: { infinity?: boolean } = {}): Quote {
  const lines: QuoteLine[] = [];
  for (const f of FORMAT_ORDER) {
    const qty = Math.max(0, Math.round(counts[f] || 0));
    if (qty) lines.push({ format: f, qty, unit: p.unit[f], total: qty * p.unit[f] });
  }
  const cards = lines.reduce((n, l) => n + l.qty, 0);
  const subtotal = lines.reduce((n, l) => n + l.total, 0);
  const freeShipping = !!opts.infinity && p.infinityFreeShipping;
  const shipping = cards && !freeShipping ? p.shipping : 0;
  const handling = cards ? p.handling : 0;
  return { lines, cards, subtotal, shipping, handling, total: subtotal + shipping + handling, freeShipping };
}

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
] as const;

export type ShipAddress = { name: string; line1: string; line2: string; city: string; state: string; zip: string };

/** Checks a US shipping address. Returns the cleaned address or which field is wrong. */
export function cleanAddress(raw: unknown): { address: ShipAddress } | { error: string; field: keyof ShipAddress } {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const c = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "");
  const a: ShipAddress = { name: c(r.name, 80), line1: c(r.line1, 120), line2: c(r.line2, 120), city: c(r.city, 60), state: c(r.state, 2).toUpperCase(), zip: c(r.zip, 10) };
  if (!a.name) return { error: "Add the name to mail it to.", field: "name" };
  if (!a.line1) return { error: "Add a street address.", field: "line1" };
  if (!a.city) return { error: "Add the city.", field: "city" };
  if (!(US_STATES as readonly string[]).includes(a.state)) return { error: "Pick a US state.", field: "state" };
  if (!/^\d{5}(-\d{4})?$/.test(a.zip)) return { error: "Add a 5-digit ZIP code.", field: "zip" };
  return { address: a };
}

export const addressLine = (a: ShipAddress) => `${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}, ${a.state} ${a.zip}`;

/** Short order number for emails and the admin: CP-7KQ4M9. */
export const codeOrderNumber = (id: string) => `CP-${id.slice(-6).toUpperCase()}`;
