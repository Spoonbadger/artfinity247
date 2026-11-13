// Which print sizes an image file is sharp enough for. Shared by the upload API, the studio form and checkout.
import { PRINT_SIZES, SIZE_IN, isPrintSize, type PrintSize } from "@/components/art/pricing";

/** Below this the print looks soft. */
export const PRINT_DPI = 150;

/** Pixels needed for a sharp print: [long edge, short edge]. */
export const PIXELS_NEEDED: Record<PrintSize, [number, number]> = Object.fromEntries(
  PRINT_SIZES.map((s) => [s, [SIZE_IN[s][1] * PRINT_DPI, SIZE_IN[s][0] * PRINT_DPI]]),
) as Record<PrintSize, [number, number]>;

export function printableFor(width: number, height: number): PrintSize[] {
  const long = Math.max(width || 0, height || 0), short = Math.min(width || 0, height || 0);
  return PRINT_SIZES.filter((s) => long >= PIXELS_NEEDED[s][0] && short >= PIXELS_NEEDED[s][1]);
}

/** "small,medium" → ["small", "medium"] in size order. Null if anything in it isn't a size. */
export function parsePrintable(raw: unknown): PrintSize[] | null {
  const parts = String(raw ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!parts.every(isPrintSize)) return null;
  return PRINT_SIZES.filter((s) => parts.includes(s));
}

/** Empty list = never checked (older uploads), so every size is allowed. */
export function sizeAllowed(printableSizes: string[] | null | undefined, size: string): boolean {
  return !printableSizes?.length || printableSizes.includes(size);
}
