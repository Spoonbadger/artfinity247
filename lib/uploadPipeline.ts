// The one upload pipeline (server-only). POST /api/uploads (files from the device) and POST /api/uploads/import
// (Google Drive, Dropbox) both end here, so an imported painting is stored, measured and signed exactly like a local one:
// private original kept, 1600px public preview with metadata stripped (lib/storage.ts), printable sizes measured
// (lib/printSizes.ts) and signed (lib/printSign.ts). The duplicate fingerprint (lib/imageHash.ts) is taken when the
// piece is published, from the stored original, so it covers both routes too.
// With Cloudinary on, files from the device don't pass through us at all (Vercel's 4.5 MB body limit): the browser
// uploads them straight to Cloudinary (POST /api/uploads/sign) and POST /api/uploads/finish lands in processDirectUpload,
// which does the same work from that stored original.
import { dropCloudUpload, finishCloudUpload, readCloudUpload, saveUpload } from "@/lib/storage";
import { printableFor } from "@/lib/printSizes";
import { signPrintable } from "@/lib/printSign";
import { MAX_UPLOAD_BYTES, UPLOAD_ERRORS } from "@/lib/uploadLimits";
import type { PrintSize } from "@/components/art/pricing";

export { UnreadableImage } from "@/lib/storage";

/** What both upload routes return for each image. */
export type UploadResult = { url: string; width: number; height: number; printable: PrintSize[]; printableSig: string };

/** Where an upload is stored and whether its original is kept privately. */
export type UploadTarget = { folder: string; cloudFolder: string; keepOriginal: boolean };

// The wording lives in lib/uploadLimits.ts so the browser can say the same thing before uploading.
export { UPLOAD_ERRORS };

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

/** A browser upload the finish step can't use: the file isn't in Cloudinary, or it's over our limits. */
export class DirectUploadProblem extends Error {
  constructor(message: string, readonly status: number, readonly code: string) {
    super(message);
  }
}

/**
 * processUpload for a file the browser already uploaded to Cloudinary as a private original at publicId (ownership is
 * checked by the caller, app/api/uploads/finish). Downloads it, checks the size and that it's an image we can read,
 * then stores the preview and measures and signs the print sizes exactly like processUpload. A file we won't use is
 * removed from Cloudinary.
 */
export async function processDirectUpload(publicId: string, format: string, keepOriginal: boolean): Promise<UploadResult> {
  const buf = await readCloudUpload(publicId, format);
  if (!buf) throw new DirectUploadProblem("That upload didn't reach us. Pick the file again.", 404, "upload_missing");
  const problem = uploadProblem(buf.length, `image/${format}`);
  if (problem) {
    await dropCloudUpload(publicId);
    throw new DirectUploadProblem(problem.error, problem.status, problem.status === 413 ? "file_too_big" : "not_image");
  }
  const { url, width, height } = await finishCloudUpload(publicId, buf, keepOriginal);
  const printable = printableFor(width, height);
  return { url, width, height, printable, printableSig: signPrintable(url, printable) };
}
