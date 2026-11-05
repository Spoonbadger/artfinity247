// POST /api/uploads  (multipart form, field "file")
// Uploads an artwork or profile image for the signed-in artist, or a buyer's wall photo for a review
// (fields reviewOrder + reviewToken from the signed review link), or a photo of a damaged print
// (fields helpOrder + helpToken from the signed help link).
// Storage is in lib/storage.ts: artwork originals are kept privately for printing and the returned url is a
// 1600px preview. Send kind=photo (profile, verification) to skip keeping the original.
// Returns { url, width, height, printable, printableSig }: printable lists the print sizes the original can support,
// printableSig lets the artwork routes trust that list (lib/printSign.ts).
// The work itself is lib/uploadPipeline.ts processUpload, shared with POST /api/uploads/import (Google Drive, Dropbox).
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { verifyReview } from "@/lib/reviews";
import { verifyHelp } from "@/lib/reprints";
import { rateLimit } from "@/lib/rateLimit";
import { artistUploadTarget, processUpload, UnreadableImage, UPLOAD_ERRORS, uploadProblem } from "@/lib/uploadPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  const form = await req.formData();
  // Buyers aren't logged in: a signed review link (lib/reviews.ts) lets them add a photo of the print on their wall.
  const reviewOrder = !user?.id ? String(form.get("reviewOrder") || "") : "";
  const reviewer = !!reviewOrder && verifyReview(reviewOrder, form.get("reviewToken")) && rateLimit(`review-upload:${reviewOrder}`, 15, 10 * 60_000);
  // Same for a photo of a damaged print, from the signed "Problem with your print?" link (lib/reprints.ts).
  const helpOrder = !user?.id && !reviewer ? String(form.get("helpOrder") || "") : "";
  const helper = !!helpOrder && verifyHelp(helpOrder, form.get("helpToken")) && rateLimit(`help-upload:${helpOrder}`, 15, 10 * 60_000);
  if (!user?.id && !reviewer && !helper) return NextResponse.json({ error: "Log in to upload.", code: "not_logged_in" }, { status: 401 });

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file came through. Pick it again.", code: "no_file" }, { status: 400 });
  const problem = uploadProblem(file.size, file.type);
  if (problem) return NextResponse.json({ error: problem.error, code: problem.status === 413 ? "file_too_big" : "not_image" }, { status: problem.status });

  const buf = Buffer.from(await file.arrayBuffer());
  const guestFolder = reviewer ? `reviews/${reviewOrder}` : `reprints/${helpOrder}`;
  const target = user?.id
    ? artistUploadTarget({ id: user.id, slug: user.slug }, form.get("kind") === "photo")
    : { folder: guestFolder, cloudFolder: `artfinity/${guestFolder}`, keepOriginal: false };
  try {
    return NextResponse.json(await processUpload(buf, file.name, target));
  } catch (err) {
    if (err instanceof UnreadableImage) return NextResponse.json({ error: UPLOAD_ERRORS.unreadable, code: "unreadable_image" }, { status: 415 });
    console.error("[uploads] failed", err);
    return NextResponse.json({ error: "Upload didn't go through on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
