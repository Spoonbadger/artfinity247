// The original painting's size, for the buy page's "Closest to the original" size tile.
//
// Artwork has no field for it and the schema stays as is, so it rides in the description as a
// structured first line the upload form writes and reads back:   Original: 24 × 30 in
// Buyers never see that line as text: the buy page strips it and shows the size where it helps.
// Client-safe (no DB).
import { SIZE_IN, type PrintSize } from "@/components/art/pricing";

export type OriginalSize = { w: number; h: number };

const LINE = /^\s*original\s*(?:size)?\s*[:\-–]\s*(\d+(?:\.\d+)?)\s*(?:["”]|in(?:ches)?\.?)?\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(in(?:ches)?\.?|["”]|cm)?\s*$/i;

const ok = (n: number) => Number.isFinite(n) && n >= 1 && n <= 600;

/** Splits "Original: 24 × 30 in" off the description's first line. `body` is the rest, as buyers should read it. */
export function splitOriginal(description: string | null | undefined): { original: OriginalSize | null; body: string } {
  const text = description ?? "";
  const nl = text.indexOf("\n");
  const first = nl === -1 ? text : text.slice(0, nl);
  const m = LINE.exec(first);
  if (!m) return { original: null, body: text };
  const k = m[3]?.toLowerCase() === "cm" ? 1 / 2.54 : 1;
  const w = Math.round(parseFloat(m[1]) * k * 10) / 10;
  const h = Math.round(parseFloat(m[2]) * k * 10) / 10;
  const body = (nl === -1 ? "" : text.slice(nl + 1)).replace(/^\s*\n/, "");
  return { original: ok(w) && ok(h) ? { w, h } : null, body };
}

const num = (n: number) => String(Math.round(n * 10) / 10);
export const originalText = (o: OriginalSize) => `${num(o.w)} × ${num(o.h)} in`;

/** Puts the structured line back on top of the artist's text (or leaves the text alone when there's no size). */
export function joinOriginal(original: OriginalSize | null, body: string): string {
  const rest = body.trim();
  if (!original || !ok(original.w) || !ok(original.h)) return rest;
  return `Original: ${originalText(original)}${rest ? `\n${rest}` : ""}`;
}

/**
 * The print size closest to the original in shape and size. Size counts most (log of the area ratio),
 * shape second (log of the short/long ratio). Orientation doesn't matter: prints turn to match the art.
 */
export function closestSize(o: OriginalSize, sizes: readonly PrintSize[]): PrintSize | null {
  if (!sizes.length) return null;
  const oShort = Math.min(o.w, o.h), oLong = Math.max(o.w, o.h);
  let best: PrintSize | null = null;
  let bestScore = Infinity;
  for (const s of sizes) {
    const [a, b] = SIZE_IN[s];
    const score = Math.abs(Math.log((a * b) / (oShort * oLong))) + 1.5 * Math.abs(Math.log(a / b / (oShort / oLong)));
    if (score < bestScore) { bestScore = score; best = s; }
  }
  return best;
}
