// POST /api/uploads  (multipart form, field "file")
// Uploads an artwork or profile image for the signed-in artist, or a buyer's wall photo for a review
// (fields reviewOrder + reviewToken from the signed review link), or a photo of a damaged print
// (fields helpOrder + helpToken from the signed help link).
// Storage is in lib/storage.ts: artwork originals are kept privately for printing and the returned url is a
// 1600px preview. Send kind=photo (profile, verification) to skip keeping the original.
// Returns { url, width, height, printable, printableSig }: printable lists the print sizes the original can support,
// printableSig lets the artwork routes trust that list (lib/printSign.ts).
import { NextRequest, NextResponse } from "next/server";
import { saveUpload, UnreadableImage } from "@/lib/storage";
import { getUserFromCookie } from "@/lib/auth";
import { printableFor } from "@/lib/printSizes";
import { signPrintable } from "@/lib/printSign";
import { verifyReview } from "@/lib/reviews";
import { verifyHelp } from "@/lib/reprints";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  const form = await req.formData();
  // Buyers aren't logged in: a signed review link (lib/reviews.ts) lets them add a photo of the print on their wall.
  const reviewOrder = !user?.id ? String(form.get("reviewOrder") || "") : "";
  const reviewer = !!reviewOrder && verifyReview(reviewOrder, form.get("reviewToken")) && rateLimit(`review-upload:${reviewOrder}`, 15, 10 * 60_000);
  // Same for a photo of a damaged print, from the signed "Problem with your print?" link (lib/reprints.ts).
  const helpOrder = !user?.id && !reviewer ? String(form.get("helpOrder") || "") : "";
  const helper = !!helpOrder && verifyHelp(helpOrder, form.get("helpToken")) && rateLimit(`help-upload:${helpOrder}`, 15, 10 * 60_000);
  if (!user?.id && !reviewer && !helper) return NextResponse.json({ error: "Log in to upload." }, { status: 401 });
  const folder = user?.id ? String(user.slug || user.id) : reviewer ? `reviews/${reviewOrder}` : `reprints/${helpOrder}`;

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 25 MB." }, { status: 413 });
  if (!/^image\//.test(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, WEBP or HEIC image." }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  let saved;
  try {
    saved = await saveUpload(buf, {
      folder,
      cloudFolder: user?.id ? `artfinity/artists/${user.slug}/artworks` : `artfinity/${folder}`,
      keepOriginal: !!user?.id && form.get("kind") !== "photo",
      fileName: file.name,
    });
  } catch (err) {
    if (err instanceof UnreadableImage) return NextResponse.json({ error: "We couldn't read that image. Try a JPG or PNG." }, { status: 415 });
    throw err;
  }
  const { url, width, height } = saved;
  const printable = printableFor(width, height);
  return NextResponse.json({ url, width, height, printable, printableSig: signPrintable(url, printable) });
}
