// Short link codes: pure helpers, safe on server and client.
// A printed QR holds only HTTPS://THEARTFINITY.COM/Q/K7P2. Upper case fits QR's compact
// alphanumeric mode (smaller grid, bigger dots); everything behind the code lives in the DB.

/** No look-alikes: no 0/O, 1/I/L. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Shown in the QR Studio preview before a code is saved. Same length as a real code, never valid (0 is not in the alphabet). */
export const PLACEHOLDER_CODE = "0000";

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{4,6}$`);

/** Upper-case, trimmed; null when it can't be a code. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const c = raw.trim().toUpperCase();
  return CODE_RE.test(c) ? c : null;
}

/** The URL a printed code holds, in capitals: HTTPS://THEARTFINITY.COM/Q/K7P2 */
export function shortUrl(code: string, base: string) {
  return `${base.replace(/\/+$/, "")}/Q/${code}`.toUpperCase();
}

/** Friendlier for screens: theartfinity.com/q/K7P2 */
export function shortLabel(code: string, base: string) {
  return `${base.replace(/^https?:\/\//i, "").replace(/\/+$/, "")}/q/${code}`;
}

export const DISCOUNT_MIN = 5;
export const DISCOUNT_MAX = 30;

/** 5-30 whole percent, else null (no discount). */
export function parseCodeDiscount(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= DISCOUNT_MIN && n <= DISCOUNT_MAX ? n : null;
}
