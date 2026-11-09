// Direct browser-to-Cloudinary image uploads, server side: who may upload where, and the signed parameters.
// Used by POST /api/uploads/sign and POST /api/uploads/finish. Pure helpers (ticket, public_id checks): lib/directUpload.ts.
//
// Who may upload is the same as POST /api/uploads: a signed-in artist (their own folder), or a buyer holding a signed
// review link (reviews/<order>) or "Problem with your print?" link (reprints/<order>), rate-limited per order.
import { requireUser } from "@/lib/auth";
import { verifyReview } from "@/lib/reviews";
import { verifyHelp } from "@/lib/reprints";
import { rateLimit } from "@/lib/rateLimit";
import { artistUploadTarget, type UploadTarget } from "@/lib/uploadPipeline";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadLimits";
import { directUploadParams, newPublicId, uploadTicket } from "@/lib/directUpload";

/** What the browser sends to both steps (besides the upload itself). */
export type UploaderInput = { kind?: unknown; reviewOrder?: unknown; reviewToken?: unknown; helpOrder?: unknown; helpToken?: unknown };

type Refused = { error: string; code: string; status: number };

export const ticketSecret = () => process.env.JWT_SECRET || "";

/**
 * Where this person's upload goes, or why they can't upload. `spend` counts one upload against the guest link's
 * limit (the sign step; finishing an upload that was already signed doesn't count twice).
 */
export async function uploaderFor(b: UploaderInput, spend: boolean): Promise<{ target: UploadTarget } | Refused> {
  const user = await requireUser().catch(() => null);
  if (user?.id) {
    // Artist uploads live under the artist's handle (lib/storage.ts inArtistFolder); a session without one is too old.
    if (!user.slug) return { error: "Log in again to upload.", code: "not_logged_in", status: 401 };
    if (spend && !rateLimit(`upload-sign:${user.id}`, 300, 10 * 60_000)) {
      return { error: "That's a lot of uploads at once. Wait a few minutes and try again.", code: "rate_limited", status: 429 };
    }
    return { target: artistUploadTarget({ id: user.id, slug: user.slug }, b.kind === "photo") };
  }
  const guest = (folder: string, limitKey: string, order: string, ok: boolean): { target: UploadTarget } | Refused | null => {
    if (!order || !ok) return null;
    if (spend && !rateLimit(`${limitKey}:${order}`, 15, 10 * 60_000)) {
      return { error: "That's a lot of photos at once. Wait a few minutes and try again.", code: "rate_limited", status: 429 };
    }
    return { target: { folder: `${folder}/${order}`, cloudFolder: `artfinity/${folder}/${order}`, keepOriginal: false } };
  };
  // Buyers aren't logged in: a signed review link (lib/reviews.ts) lets them add a photo of the print on their wall,
  // and the signed help link (lib/reprints.ts) a photo of a damaged print.
  const reviewOrder = String(b.reviewOrder || "");
  const helpOrder = String(b.helpOrder || "");
  return (
    guest("reviews", "review-upload", reviewOrder, !!reviewOrder && verifyReview(reviewOrder, b.reviewToken)) ||
    guest("reprints", "help-upload", helpOrder, !!helpOrder && verifyHelp(helpOrder, b.helpToken)) ||
    { error: "Log in to upload.", code: "not_logged_in", status: 401 }
  );
}

/**
 * Signed parameters for one direct upload into the target's folder, as a private original. The browser posts them
 * with the file to `url`, then sends `publicId`, `ticket` and Cloudinary's reported format to /api/uploads/finish.
 */
export async function signImageUpload(target: UploadTarget) {
  const cloudinary = (await import("@/lib/cloudinary")).default;
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = newPublicId(target.cloudFolder);
  const params = directUploadParams(publicId, timestamp);
  const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET as string);
  return {
    url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    fields: { ...params, api_key: process.env.CLOUDINARY_API_KEY as string, signature },
    publicId,
    ticket: uploadTicket(ticketSecret(), publicId, target.keepOriginal, timestamp),
    maxBytes: MAX_UPLOAD_BYTES,
  };
}
