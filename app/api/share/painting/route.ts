// GET /api/share/painting?art=<slug> → the painting as a same-origin JPEG (max 1600 px),
// so the Studio's video maker can draw it on a canvas without cross-origin taint.
// &w=<px> gives a smaller copy (embed widget, email signature thumbnail).
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getUserFromCookie } from "@/lib/auth";
import { canSee, findShareArt, paintingSource } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("art") || "";
  const row = slug ? await findShareArt(slug) : null;
  if (!row) return new NextResponse("Artwork not found", { status: 404 });
  const isPublic = row.status === "APPROVED";
  if (!isPublic && !canSee(row, await getUserFromCookie())) return new NextResponse("Artwork not found", { status: 404 });
  try {
    const src = await paintingSource(row.art.imageUrl);
    // Snap to a few sizes so the URL can't be used to make endless resizes.
    const want = Number(req.nextUrl.searchParams.get("w")) || 0;
    const w = want > 0 ? [160, 320, 640, 960].find((s) => s >= want) ?? 0 : 0;
    const buf = w ? await sharp(src.buf).resize(w, w * 2, { fit: "inside" }).jpeg({ quality: 84 }).toBuffer() : src.buf;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "image/jpeg", "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store" },
    });
  } catch (err) {
    console.error("Share painting error", err);
    return new NextResponse("Could not load the painting", { status: 500 });
  }
}
