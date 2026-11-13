// Perceptual fingerprints for artwork images, to catch the same picture uploaded by a second artist. Server-only.
//
// dHash: shrink to 9x8 grey pixels and record, for each row, whether each pixel is brighter than its right-hand
// neighbour. 64 bits, stored as 16 hex chars on Artwork.imageHash. Re-encoding, resizing, light crops and small
// colour changes move only a few bits; different pictures differ in ~20-40.
//
// Matching is an in-memory scan of every stored hash (one indexed column, ~40 bytes a row). That is fine to
// roughly 100k artworks (a few MB, a few ms). Past that, move the comparison into Postgres
// (bit_count(hash::bit(64) # $1)) or a BK-tree / multi-index hash so a lookup doesn't read every row.
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { readStoredImage } from "@/lib/storage";

/** Hamming distance at or below this counts as the same picture. */
export const DUPLICATE_DISTANCE = 6;
export const DUPLICATE_PREFIX = "possible_duplicate:";

export async function dHash(input: Buffer): Promise<string | null> {
  try {
    const px = await sharp(input, { failOn: "none" })
      .rotate()
      .flatten({ background: "#ffffff" })
      .grayscale()
      .resize(9, 8, { fit: "fill", kernel: "lanczos3" })
      .raw()
      .toBuffer();
    let hex = "";
    for (let y = 0; y < 8; y++) {
      let byte = 0;
      for (let x = 0; x < 8; x++) byte = (byte << 1) | (px[y * 9 + x] > px[y * 9 + x + 1] ? 1 : 0);
      hex += byte.toString(16).padStart(2, "0");
    }
    return hex;
  } catch {
    return null;
  }
}

const POP = Array.from({ length: 256 }, (_, i) => { let n = 0; for (let v = i; v; v >>= 1) n += v & 1; return n; });

export function hamming(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let d = 0;
  for (let i = 0; i < 16; i += 2) d += POP[parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16)];
  return d;
}

/** Hash of the image behind a preview URL: the private original when we kept one, else the preview. */
export async function hashForImageUrl(url: string): Promise<string | null> {
  const buf = await readStoredImage(url).catch(() => null);
  return buf ? dHash(buf) : null;
}

export type DuplicateMatch = { artworkId: string; artistId: string; distance: number };

/**
 * Closest near-duplicates of `hash`: `other` = another artist's piece (not rejected), `own` = the same artist's.
 * `excludeId` skips the artwork being edited.
 */
export async function findDuplicates(hash: string, artistId: string, excludeId?: string): Promise<{ other: DuplicateMatch | null; own: DuplicateMatch | null }> {
  const rows = await prisma.artwork.findMany({
    where: { imageHash: { not: null }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { id: true, artistId: true, imageHash: true, status: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  let other: DuplicateMatch | null = null;
  let own: DuplicateMatch | null = null;
  for (const r of rows) {
    const d = hamming(hash, r.imageHash!);
    if (d > DUPLICATE_DISTANCE) continue;
    const m = { artworkId: r.id, artistId: r.artistId, distance: d };
    if (r.artistId === artistId) { if (!own || d < own.distance) own = m; }
    else if (r.status !== "REJECTED" && (!other || d < other.distance)) other = m;
  }
  return { other, own };
}

export const DUPLICATE_REVIEW_NOTE = "This looks like a piece already on Artfinity, so our moderation team will check it, usually within a day.";
export const DUPLICATE_OWN_NOTE = "You've uploaded this image before. No problem, just so you know.";

/**
 * Hash a new or replaced image and decide what happens. A match with another artist's piece sends it to review
 * (never an automatic rejection); a match with the artist's own work just earns a soft note.
 */
export async function checkUpload(imageUrl: string, artistId: string, excludeId?: string) {
  const imageHash = await hashForImageUrl(imageUrl);
  if (!imageHash) return { imageHash: null, flaggedReason: null, notice: null, duplicate: null as null | "review" | "own" };
  const { other, own } = await findDuplicates(imageHash, artistId, excludeId);
  if (other) {
    console.info("POSSIBLE_DUPLICATE", JSON.stringify({ artistId, imageUrl, matches: other.artworkId, distance: other.distance }));
    return { imageHash, flaggedReason: `${DUPLICATE_PREFIX}${other.artworkId}`, notice: DUPLICATE_REVIEW_NOTE, duplicate: "review" as const };
  }
  if (own) return { imageHash, flaggedReason: null, notice: DUPLICATE_OWN_NOTE, duplicate: "own" as const };
  return { imageHash, flaggedReason: null, notice: null, duplicate: null };
}

export const duplicateOfId = (flaggedReason: string | null | undefined) =>
  flaggedReason?.startsWith(DUPLICATE_PREFIX) ? flaggedReason.slice(DUPLICATE_PREFIX.length) || null : null;

/**
 * Early check for an imported painting (POST /api/uploads/import), on the downloaded bytes, so the queue can say so
 * before the artist fills it in. `own` = the artist's own piece (title + slug, to link to); `other` = looks like
 * another artist's piece (no details shown: checkUpload sends it to review when it's published).
 */
export async function duplicateOfUpload(buf: Buffer, artistId: string): Promise<{ own: { slug: string; title: string } | null; other: boolean }> {
  const hash = await dHash(buf);
  if (!hash) return { own: null, other: false };
  const { other, own } = await findDuplicates(hash, artistId);
  const mine = own ? await prisma.artwork.findUnique({ where: { id: own.artworkId }, select: { slug: true, title: true } }) : null;
  return { own: mine?.slug ? { slug: mine.slug, title: mine.title } : null, other: !!other };
}
