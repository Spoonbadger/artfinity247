// The one upload pipeline (server-only). POST /api/uploads (files from the device) and POST /api/uploads/import
// (Google Drive, Dropbox) both end here, so an imported painting is stored, measured and signed exactly like a local one:
// private original kept, 1600px public preview with metadata stripped (lib/storage.ts), printable sizes measured
// (lib/printSizes.ts) and signed (lib/printSign.ts). The duplicate fingerprint (lib/imageHash.ts) is taken when the
// piece is published, from the stored original, so it covers both routes too.
import { saveUpload } from "@/lib/storage";
import { printableFor } from "@/lib/printSizes";
import { signPrintable } from "@/lib/printSign";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";
import type { PrintSize } from "@/components/art/pricing";

export { UnreadableImage } from "@/lib/storage";

/** What both upload routes return for each image. */
export type UploadResult = { url: string; width: number; height: number; printable: PrintSize[]; printableSig: string };

/** Where an upload is stored and whether its original is kept privately. */
export type UploadTarget = { folder: string; cloudFolder: string; keepOriginal: boolean };

export const UPLOAD_ERRORS = {
  tooBig: `That file is over ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
  notImage: "Upload a JPG, PNG, WEBP or HEIC image.",
  unreadable: "We couldn't read that image. Try a JPG or PNG.",
} as const;

/** An artist's artwork upload: kept privately for printing unless `photo` (profile and verification pictures). */
export function artistUploadTarget(user: { id: string; slug?: string }, photo = false): UploadTarget {
  return { folder: String(user.slug || user.id), cloudFolder: `artfinity/artists/${user.slug}/artworks`, keepOriginal: !photo };
}

/** Size and type limits (lib/uploadLimits.ts), checked before any work. null = fine. */
export function uploadProblem(size: number, type: string): { error: string; status: number } | null {
  if (size > MAX_UPLOAD_BYTES) return { error: UPLOAD_ERRORS.tooBig, status: 413 };
  if (!/^image\//.test(type)) return { error: UPLOAD_ERRORS.notImage, status: 415 };
  return null;
}

/** Stores one image and measures what it can print at. Throws UnreadableImage when it isn't an image we can read. */
export async function processUpload(buf: Buffer, fileName: string, target: UploadTarget): Promise<UploadResult> {
  const { url, width, height } = await saveUpload(buf, { ...target, fileName });
  const printable = printableFor(width, height);
  return { url, width, height, printable, printableSig: signPrintable(url, printable) };
}
