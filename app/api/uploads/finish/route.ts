// POST /api/uploads/finish  JSON { publicId, ticket, format, kind?, reviewOrder?, reviewToken?, helpOrder?, helpToken? }
// Step 2 of a direct upload (POST /api/uploads/sign): the browser has put the file in Cloudinary as a private original
// and tells us which one. We check it's this person's (their folder + our signed ticket), then do what POST /api/uploads
// does, from that stored file: size and type limits, readable image, 1600px public preview, print sizes measured and
// signed (lib/uploadPipeline.ts processDirectUpload). The original stays private for printing (artwork) or is removed
// once the preview exists (profile and verification photos, buyers' photos).
// Returns the POST /api/uploads shape: { url, width, height, printable, printableSig }.
import { NextRequest, NextResponse } from "next/server";
import { cloudinaryOn } from "@/lib/storage";
import { directFormat, ownsPublicId, readTicket } from "@/lib/directUpload";
import { ticketSecret, uploaderFor, type UploaderInput } from "@/lib/directUpload.server";
import { DirectUploadProblem, processDirectUpload, UnreadableImage, UPLOAD_ERRORS } from "@/lib/uploadPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Downloads the original (up to 25 MB) from Cloudinary and makes the preview.
export const maxDuration = 60;

const no = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

export async function POST(req: NextRequest) {
  if (!cloudinaryOn()) return no("Uploads go through the page here. Reload it and try again.", "use_form", 409);
  const b = ((await req.json().catch(() => null)) || {}) as UploaderInput & { publicId?: unknown; ticket?: unknown; format?: unknown };
  const who = await uploaderFor(b, false);
  if ("error" in who) return no(who.error, who.code, who.status);
  // Only a file in this artist's (or this order's) folder, signed by us for it: nobody can claim someone else's upload.
  if (!ownsPublicId(b.publicId, who.target.cloudFolder)) return no("That upload isn't yours. Pick the file again.", "not_yours", 403);
  const ticket = readTicket(ticketSecret(), b.publicId, b.ticket);
  if (!ticket) return no("That upload took too long to finish. Pick the file again.", "upload_expired", 400);
  const format = directFormat(b.format);
  if (!format) return no(UPLOAD_ERRORS.notImage, "not_image", 415);
  try {
    return NextResponse.json(await processDirectUpload(b.publicId, format, ticket.keep));
  } catch (err) {
    if (err instanceof DirectUploadProblem) return no(err.message, err.code, err.status);
    if (err instanceof UnreadableImage) return no(UPLOAD_ERRORS.unreadable, "unreadable_image", 415);
    console.error("[uploads/finish] failed", err);
    return no("Upload didn't go through on our side. Try again in a moment.", "server_error", 500);
  }
}
