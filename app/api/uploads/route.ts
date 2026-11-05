// POST /api/uploads  (multipart form, field "file")
// Uploads an artwork or profile image for the signed-in artist, or a buyer's wall photo for a review
// (fields reviewOrder + reviewToken from the signed review link).
// With Cloudinary env vars set it uploads there; otherwise it saves to public/uploads (local dev).
// Returns { url, width, height, printable, printableSig }: printable lists the print sizes the file can support,
// printableSig lets the artwork routes trust that list (lib/printSign.ts).
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { getUserFromCookie } from "@/lib/auth";
import { printableFor } from "@/lib/printSizes";
import { signPrintable } from "@/lib/printSign";
import { verifyReview } from "@/lib/reviews";
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
  if (!user?.id && !reviewer) return NextResponse.json({ error: "Log in to upload." }, { status: 401 });
  const folder = user?.id ? String(user.slug || user.id) : `reviews/${reviewOrder}`;

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 25 MB." }, { status: 413 });
  if (!/^image\//.test(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, WEBP or HEIC image." }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  let width = 0, height = 0;
  try { const meta = await sharp(buf).metadata(); width = meta.width || 0; height = meta.height || 0; } catch {}

  let url: string;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    const { default: cloudinary } = await import("@/lib/cloudinary");
    const res: any = await new Promise((resolve, reject) =>
      cloudinary.uploader.upload_stream({ folder: user?.id ? `artfinity/artists/${user.slug}/artworks` : `artfinity/${folder}` }, (err, r) => (err ? reject(err) : resolve(r))).end(buf)
    );
    url = res.secure_url;
    // Cloudinary reads formats sharp can't (e.g. some HEIC files)
    if (!width && res.width) { width = res.width; height = res.height; }
  } else {
    // Local dev: store a web-sized JPEG under public/uploads
    const dir = path.join(process.cwd(), "public", "uploads", ...folder.split("/"));
    await fs.mkdir(dir, { recursive: true });
    const name = crypto.randomBytes(6).toString("hex") + ".jpg";
    await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(dir, name));
    url = `/uploads/${folder}/${name}`;
  }
  const printable = printableFor(width, height);
  return NextResponse.json({ url, width, height, printable, printableSig: signPrintable(url, printable) });
}
