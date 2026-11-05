// GET /api/share/image?art=<slug>&format=story|square|landscape&layout=wall|bleed|studio[&dl=1]
// A ready-to-post PNG: the painting, title, artist, "Prints from $X" and a QR code to the artwork.
import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getUserFromCookie } from "@/lib/auth";
import { loadFonts } from "@/components/qr/text";
import { shareSVG } from "@/components/share/imageSvg";
import { IMAGE_FORMATS, artLink, handleText, isFormat, isLayout } from "@/components/share/shareData";
import { baseUrl, canSee, findShareArt, grain, paintingSource } from "../_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const rendered = new Map<string, Buffer>();

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const slug = q.get("art") || "";
  const format = isFormat(q.get("format")) ? (q.get("format") as keyof typeof IMAGE_FORMATS) : "story";
  const layoutQ = q.get("layout");
  const layout = isLayout(layoutQ) ? layoutQ : "wall";
  if (!slug) return new NextResponse("Missing art", { status: 400 });

  const row = await findShareArt(slug);
  if (!row) return new NextResponse("Artwork not found", { status: 404 });
  const isPublic = row.status === "APPROVED";
  if (!isPublic && !canSee(row, await getUserFromCookie())) return new NextResponse("Artwork not found", { status: 404 });

  const base = baseUrl(req);
  const { art } = row;
  const key = JSON.stringify([format, layout, base, art]);
  let png = rendered.get(key);
  if (!png) {
    try {
      const [fonts, src, noise] = await Promise.all([loadFonts(), paintingSource(art.imageUrl), grain()]);
      const box = IMAGE_FORMATS[format];
      const fitted = await sharp(src.buf).resize(Math.round(box.w * 0.85), Math.round(box.h * 0.6), { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
      const blurred = layout === "bleed"
        ? "data:image/jpeg;base64," + (await sharp(src.buf).resize(160, 160, { fit: "cover" }).blur(6).modulate({ saturation: 1.15 }).jpeg({ quality: 80 }).toBuffer()).toString("base64")
        : undefined;
      const svg = shareSVG({
        format, layout, art, fonts, noise, blurred, palette: src.palette,
        painting: { href: "data:image/jpeg;base64," + fitted.toString("base64"), w: src.w, h: src.h },
        qrText: artLink(base, art.handle, art.slug, `share-${format}`),
        handle: handleText(base, art.handle),
      });
      png = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
      if (rendered.size > 60) rendered.delete(rendered.keys().next().value as string);
      rendered.set(key, png);
    } catch (err) {
      console.error("Share image error", err);
      return new NextResponse("Could not make the image", { status: 500 });
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
    "Cache-Control": isPublic ? "public, max-age=600, stale-while-revalidate=86400" : "private, no-store",
  };
  if (q.get("dl")) headers["Content-Disposition"] = `attachment; filename="${`${art.slug}-${format}-${layout}`.replace(/[^a-z0-9._-]+/gi, "-")}.png"`;
  return new NextResponse(new Uint8Array(png), { status: 200, headers });
}
