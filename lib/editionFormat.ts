// Client-safe edition helpers (no DB). Server-side counting lives in lib/editions.ts.

export const EDITION_MIN = 5;
export const EDITION_MAX = 500;
/** "Last few" shows at this many left or fewer. */
export const LAST_FEW = 3;

export type Edition = { size: number; sold: number; left: number; soldOut: boolean; lastFew: boolean };

export function editionOf(editionSize: number | null | undefined, sold: number): Edition | null {
  if (!editionSize) return null;
  const left = Math.max(0, editionSize - sold);
  return { size: editionSize, sold, left, soldOut: left === 0, lastFew: left > 0 && left <= LAST_FEW };
}

/** "Print 8 of 25", or "Prints 8–10 of 25" for a line of 3. */
export function editionLabel(first: number | null | undefined, quantity: number | null | undefined, size: number | null | undefined) {
  if (!first || !size) return "";
  const q = Math.max(1, quantity || 1);
  return q > 1 ? `Prints ${first}–${first + q - 1} of ${size}` : `Print ${first} of ${size}`;
}
