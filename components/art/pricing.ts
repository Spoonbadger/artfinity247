// Scan-page pricing and scan-context helpers. Shared by the page, the cart and the checkout API.
import { basePrices, framePrices, getFinalPrice } from "@/lib/artwork_price";

export type PrintSize = keyof typeof basePrices; // small | medium | large | xl
export type FrameColor = "black" | "white" | "natural";

export const PRINT_SIZES: PrintSize[] = ["small", "medium", "large", "xl"];
export const SIZE_LABEL: Record<PrintSize, string> = { small: "Small", medium: "Medium", large: "Large", xl: "XL" };
/** Short side × long side, in inches. */
export const SIZE_IN: Record<PrintSize, [number, number]> = { small: [5, 7], medium: [8, 12], large: [11, 17], xl: [18, 24] };
export const sizeInches = (s: PrintSize) => `${SIZE_IN[s][0]} × ${SIZE_IN[s][1]} in`;

export const FRAME_COLORS: { key: FrameColor; label: string; hex: string }[] = [
  { key: "black", label: "Black", hex: "#15161b" },
  { key: "white", label: "White", hex: "#ffffff" },
  { key: "natural", label: "Natural wood", hex: "#c79b6a" },
];

export const MIN_OFF = 5;
export const MAX_OFF = 30;

/** `?off=10` → 10. Anything outside 5–30 (or not a number) means no discount. */
export function parseDiscount(raw: unknown): number {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < MIN_OFF || n > MAX_OFF) return 0;
  return n;
}

/** `?at=Brooklyn%20Flea` → "Brooklyn Flea" (trimmed, max 60 chars). */
export function parseVenue(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, 60);
  return s || null;
}

export function isPrintSize(v: unknown): v is PrintSize {
  return typeof v === "string" && (PRINT_SIZES as string[]).includes(v);
}

type Markups = { markupSmall?: number | null; markupMedium?: number | null; markupLarge?: number | null; markupXl?: number | null };

export function markupFor(art: Markups, size: PrintSize): number {
  const m = size === "small" ? art.markupSmall : size === "medium" ? art.markupMedium : size === "large" ? art.markupLarge : art.markupXl;
  return Number(m ?? 0) || 0;
}

export const applyDiscount = (cents: number, pct: number) => Math.round(cents * (1 - (pct || 0) / 100));

/** List price and the price after the scan discount, in cents. */
export function priceFor(art: Markups, size: PrintSize, framed = false, pct = 0) {
  const list = getFinalPrice(size, markupFor(art, size), framed);
  return { list, now: applyDiscount(list, pct) };
}

export const framePrice = (size: PrintSize) => framePrices[size];

export const usd = (cents: number) => "$" + ((cents || 0) / 100).toFixed(2);

/** Escape text before it goes into an SVG/HTML string (tagSVG takes raw strings). */
export const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
