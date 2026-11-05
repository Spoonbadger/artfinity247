// Signed scan discounts. A printed code's discount (?off=) only counts when it carries a matching
// signature (?s=), made on the server from the artwork, percent and venue. Typing ?off=30 by hand does nothing.
// Server-only: uses the signing secret.
import crypto from "crypto";

const SECRET = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";

function payload(slug: string, off: number, at?: string | null) {
  return `${slug.toLowerCase()}|${off}|${(at || "").trim()}`;
}

export function signScan(slug: string, off: number, at?: string | null): string {
  return crypto.createHmac("sha256", SECRET).update(payload(slug, off, at)).digest("base64url").slice(0, 12);
}

export function verifyScan(slug: string, off: number, at: string | null | undefined, sig: unknown): boolean {
  if (!off || !SECRET || typeof sig !== "string" || sig.length !== 12) return false;
  const want = Buffer.from(signScan(slug, off, at));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** Server-side version of components/qr/card.ts qrValue that signs the discount. */
export async function signedQrValue(d: { ev: string; disc: number }, slug: string, base: string, handle?: string | null) {
  const { qrValue } = await import("@/components/qr/card");
  return qrValue(d, slug, base, d.disc ? signScan(slug, d.disc, d.ev.trim() || null) : null, null, handle);
}

// Cards printed before discounts were signed carry a plain ?off=. We honor those up to
// LEGACY_MAX_PCT until LEGACY_UNTIL, so a buyer holding an old "10% off" card isn't let down.
export const LEGACY_MAX_PCT = 10;
export const LEGACY_UNTIL = new Date(process.env.LEGACY_DISCOUNT_UNTIL || "2027-03-01T00:00:00-05:00");

/** The scan discount to apply: signed (any valid %), legacy unsigned (capped), or none with `ended` set. */
export function scanDiscount(slug: string, off: number, at: string | null | undefined, sig: unknown, now = new Date()) {
  if (!off) return { pct: 0, legacy: false, ended: false };
  if (verifyScan(slug, off, at, sig)) return { pct: off, legacy: false, ended: false };
  const unsigned = sig === undefined || sig === null || sig === "";
  if (unsigned && now < LEGACY_UNTIL) return { pct: Math.min(off, LEGACY_MAX_PCT), legacy: true, ended: false };
  return { pct: 0, legacy: false, ended: true };
}
