// POST /api/uploads  (multipart form, field "file")
// Uploads an artwork or profile image for the signed-in artist.
// With Cloudinary env vars set it uploads there; otherwise it saves to public/uploads (local dev).
// Returns { url, width, height, printable } where printable lists the print sizes the file can support.
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { getUserFromCookie } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
// Pixels needed for a sharp print at 150 DPI (long edge x short edge)
const NEED = { small: [1050, 750], medium: [1800, 1200], large: [2550, 1650], xl: [3600, 2700] } as const;

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to upload." }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That file is over 25 MB." }, { status: 413 });
  if (!/^image\//.test(file.type)) return NextResponse.json({ error: "Upload a JPG, PNG, WEBP or HEIC image." }, { status: 415 });

  const buf = Buffer.from(await file.arrayBuffer());
  let width = 0, height = 0;
  try { const meta = await sharp(buf).metadata(); width = meta.width || 0; height = meta.height || 0; } catch {}
  const long = Math.max(width, height), short = Math.min(width, height);
  const printable = (Object.keys(NEED) as (keyof typeof NEED)[]).filter((k) => long >= NEED[k][0] && short >= NEED[k][1]);

  let url: string;
  if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    const { default: cloudinary } = await import("@/lib/cloudinary");
    const res: any = await new Promise((resolve, reject) =>
      cloudinary.uploader.upload_stream({ folder: `artfinity/artists/${user.slug}/artworks` }, (err, r) => (err ? reject(err) : resolve(r))).end(buf)
    );
    url = res.secure_url;
  } else {
    // Local dev: store a web-sized JPEG under public/uploads
    const dir = path.join(process.cwd(), "public", "uploads", String(user.slug || user.id));
    await fs.mkdir(dir, { recursive: true });
    const name = crypto.randomBytes(6).toString("hex") + ".jpg";
    await sharp(buf).rotate().resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toFile(path.join(dir, name));
    url = `/uploads/${user.slug || user.id}/${name}`;
  }
  return NextResponse.json({ url, width, height, printable });
}
