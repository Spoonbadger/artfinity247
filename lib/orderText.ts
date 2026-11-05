// How an order reads to buyers: the short code and friendly size names. Pure, safe anywhere.
import { FRAME_COLORS, SIZE_LABEL, isPrintSize, sizeInches } from "@/components/art/pricing";

/** The short order code buyers see on the thank-you page and in their emails (last 6 of the id, upper case). */
export const orderCode = (id: string) => id.slice(-6).toUpperCase();

// Stored sizes are "M", "MEDIUM" or "medium"; buyers read "Medium · 8 × 12 in".
const SHORT: Record<string, string> = { S: "small", M: "medium", L: "large", XL: "xl" };
export function friendlySize(raw: string | null | undefined) {
  const s = (raw || "").trim();
  const k = SHORT[s.toUpperCase()] ?? s.toLowerCase();
  return isPrintSize(k) ? `${SIZE_LABEL[k]} · ${sizeInches(k)}` : s || null;
}

/** "Black frame", or null when unframed. */
export const frameText = (chosen: boolean | null | undefined, color: string | null | undefined) =>
  chosen ? `${FRAME_COLORS.find((f) => f.key === color)?.label ?? "Black"} frame` : null;
