// Small, pure helpers for direct-to-Cloudinary image uploads (POST /api/uploads/sign, then /api/uploads/finish).
// Vercel functions refuse request bodies over 4.5 MB, so with Cloudinary on the browser sends the file straight to
// Cloudinary, into a private ("authenticated") asset whose public_id we chose and signed. The finish step then builds
// the preview and print sizes from that asset (lib/uploadPipeline.ts processDirectUpload).
// No imports from the app, so lib/directUpload.test.mjs can run these with plain Node. Server-only (node:crypto).
import crypto from "node:crypto";

/** Formats Cloudinary may accept for an artwork or photo upload. Anything else is refused by Cloudinary itself. */
export const DIRECT_FORMATS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "tif", "tiff", "gif", "avif", "bmp"] as const;

/** How long after signing the finish step still accepts the upload (Cloudinary's own signature lasts 1 hour). */
export const TICKET_MAX_AGE_S = 2 * 60 * 60;

/** A fresh public_id in the given folder: <folder>/<12 hex>, the same name shape saveUpload uses. */
export function newPublicId(cloudFolder: string): string {
  return `${cloudFolder}/${crypto.randomBytes(6).toString("hex")}`;
}

/**
 * The upload parameters Cloudinary checks against our signature: where the file goes (public_id, so the folder is
 * pinned to this artist or order), that it stays private (type authenticated), that it's an image format we take,
 * that an existing asset is never replaced, and when it was signed (Cloudinary refuses it after an hour).
 */
export function directUploadParams(publicId: string, timestamp: number): Record<string, string> {
  return {
    public_id: publicId,
    type: "authenticated",
    allowed_formats: DIRECT_FORMATS.join(","),
    overwrite: "false",
    timestamp: String(timestamp),
  };
}

function mac(secret: string, publicId: string, keep: boolean, ts: number) {
  return crypto.createHmac("sha256", secret).update(`direct-upload|${publicId}|${keep ? 1 : 0}|${ts}`).digest("base64url").slice(0, 22);
}

/**
 * Our own receipt for a signed upload, handed back at the finish step: "<timestamp>.<keep 1|0>.<mac>". It ties the
 * public_id to whether the original is kept privately (artwork) or dropped once the preview exists (photos, guests).
 */
export function uploadTicket(secret: string, publicId: string, keep: boolean, ts: number): string {
  if (!secret) throw new Error("No signing secret");
  return `${ts}.${keep ? 1 : 0}.${mac(secret, publicId, keep, ts)}`;
}

/** The ticket's keep flag when it's ours, for this public_id and not too old; otherwise null. */
export function readTicket(secret: string, publicId: string, ticket: unknown, nowS = Math.floor(Date.now() / 1000)): { keep: boolean } | null {
  if (!secret || typeof ticket !== "string") return null;
  const m = /^(\d{9,11})\.([01])\.([\w-]{22})$/.exec(ticket);
  if (!m) return null;
  const ts = Number(m[1]);
  const keep = m[2] === "1";
  if (ts > nowS + 60 || nowS - ts > TICKET_MAX_AGE_S) return null;
  const want = Buffer.from(mac(secret, publicId, keep, ts));
  const got = Buffer.from(m[3]);
  return want.length === got.length && crypto.timingSafeEqual(want, got) ? { keep } : null;
}

/** Whether a public_id is one of ours, directly inside this folder (no deeper path, no "..", no other folder). */
export function ownsPublicId(publicId: unknown, cloudFolder: string): publicId is string {
  if (typeof publicId !== "string" || !cloudFolder) return false;
  return publicId.startsWith(`${cloudFolder}/`) && /^[a-f0-9]{12}$/.test(publicId.slice(cloudFolder.length + 1));
}

/** The format Cloudinary reported for the upload, if it's one we allow. */
export function directFormat(format: unknown): string | null {
  const f = typeof format === "string" ? format.toLowerCase() : "";
  return (DIRECT_FORMATS as readonly string[]).includes(f) ? f : null;
}
