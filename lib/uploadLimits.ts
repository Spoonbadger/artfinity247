// Upload limits shared by the upload APIs, the Studio upload form and the help center. Client-safe.

/** Largest image POST /api/uploads accepts. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Most images one upload queue takes (several files or a whole folder on /studio/art/new). */
export const QUEUE_MAX = 50;

/** New artworks an artist can publish per day (POST /api/artworks/upload). */
export const DAILY_UPLOAD_LIMIT = 50;

/** Images uploading at once while a queue fills. */
export const QUEUE_CONCURRENCY = 3;

const MB = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** What every upload route says when a file can't be taken. */
export const UPLOAD_ERRORS = {
  tooBig: `That file is over ${MB(MAX_UPLOAD_BYTES)} MB.`,
  notImage: "Upload a JPG, PNG, WEBP or HEIC image.",
  unreadable: "We couldn't read that image. Try a JPG or PNG.",
} as const;

/**
 * Plain words for an error Cloudinary sends back when the browser uploads a file straight to it
 * (components/media/uploadImage.ts). Cloudinary's own limits (plan file size, megapixels) can be lower than ours.
 */
export function cloudinaryErrorText(message: unknown): { error: string; code: string } {
  const m = typeof message === "string" ? message : "";
  const size = /file size too large.*?maximum is (\d+)/i.exec(m);
  if (size) return { error: `That file is over ${Math.max(1, MB(Number(size[1])))} MB.`, code: "file_too_big" };
  if (/file size too large/i.test(m)) return { error: UPLOAD_ERRORS.tooBig, code: "file_too_big" };
  // e.g. "Image is too large: 108.0 Megapixels. Max allowed: 25 Megapixels" or "... Maximum allowed is 25000000 pixels"
  if (/pixel/i.test(m)) {
    const max = /max[^\d]*(\d+(?:\.\d+)?)\s*(mega ?pixels?|mp|pixels?)?/i.exec(m);
    let mp = max ? Number(max[1]) : 0;
    if (max && (/^pixel/i.test(max[2] || "") || mp > 10_000)) mp = mp / 1_000_000;
    const under = mp >= 1 ? ` under ${Math.floor(mp)} megapixels` : "";
    return { error: `That image has too many pixels. Save a smaller copy${under} and try again.`, code: "too_many_pixels" };
  }
  if (/format .*not allowed|not allowed.*format/i.test(m)) return { error: UPLOAD_ERRORS.notImage, code: "not_image" };
  if (/invalid image|unsupported|corrupt|unknown file format/i.test(m)) return { error: UPLOAD_ERRORS.unreadable, code: "unreadable_image" };
  if (/stale request|timestamp/i.test(m)) return { error: "The upload took too long. Try again.", code: "upload_expired" };
  return { error: "Upload didn't go through. Try again in a moment.", code: "upload_failed" };
}
