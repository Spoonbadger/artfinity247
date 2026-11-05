// GET /api/scenes/render?scene=<0-999>&art=<slug>&size=small|medium|large|xl&frame=none|black|white|natural&w=800&mat=0&blur=1
// One photo scene with the print hung at true size, as a JPEG. Cached on disk by content key, with an ETag.
// 404 when no photo scenes are built (the site then draws the procedural rooms instead).
import { NextResponse } from "next/server";
import path from "node:path";
import fsp from "node:fs/promises";
import crypto from "node:crypto";
import { loadCatalog, variantForScene } from "@/lib/scenes/catalog";
import { composite, COMPOSITOR_VERSION } from "@/lib/scenes/composite";
import { artForRender, readArtImage, sceneCacheDir } from "@/lib/scenes/server";
import { FRAME_KEYS, PRINT_SIZE_KEYS, type FrameKey, type PrintSizeKey } from "@/lib/scenes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTHS = [480, 800, 1200, 1600];

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const catalog = loadCatalog();
  if (!catalog) return NextResponse.json({ error: "No photo scenes." }, { status: 404 });
  const n = Number(q.get("scene"));
  if (!Number.isInteger(n) || n < 0 || n > 999) return NextResponse.json({ error: "Scene is 0 to 999." }, { status: 400 });
  const hit = variantForScene(catalog, n);
  if (!hit) return NextResponse.json({ error: "No such scene." }, { status: 404 });
  const size = (PRINT_SIZE_KEYS as string[]).includes(q.get("size") || "") ? (q.get("size") as PrintSizeKey) : "medium";
  const frame = (FRAME_KEYS as string[]).includes(q.get("frame") || "") ? (q.get("frame") as FrameKey) : "none";
  const wq = Number(q.get("w")) || 1200;
  const width = WIDTHS.reduce((best, w) => (Math.abs(w - wq) < Math.abs(best - wq) ? w : best), WIDTHS[0]);
  const mat = q.get("mat") !== "0";

  const art = await artForRender(q.get("art") || "");
  if (!art) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });
  const blur = q.get("blur") === "1" || false;

  const key = crypto
    .createHash("sha1")
    .update([COMPOSITOR_VERSION, catalog.rev, hit.variant.id, hit.photo.ann.updatedAt, art.imageUrl, size, frame, mat, blur, width].join("|"))
    .digest("hex")
    .slice(0, 24);
  const etag = `"${key}"`;
  const headers = {
    "Content-Type": "image/jpeg",
    ETag: etag,
    // URLs carry the catalog rev; art changes change the ETag
    "Cache-Control": "public, max-age=3600, stale-while-revalidate=604800",
    "X-Scene-Variant": hit.variant.id,
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });

  const dir = await sceneCacheDir();
  const file = dir ? path.join(dir, `${key}.jpg`) : null;
  if (file) {
    try {
      const buf = await fsp.readFile(file);
      return new NextResponse(new Uint8Array(buf), { headers: { ...headers, "X-Cache": "hit" } });
    } catch {}
  }
  const img = await readArtImage(art.imageUrl);
  if (!img) return NextResponse.json({ error: "Image unavailable." }, { status: 502 });
  try {
    const r = await composite({ scene: n, art: img, size, frame, mat, width, blur, catalog });
    if (file) fsp.writeFile(file, r.jpeg).catch(() => {});
    return new NextResponse(new Uint8Array(r.jpeg), { headers: { ...headers, "X-Cache": "miss", "X-Print-Size": r.rect.label.replace("×", "x") } });
  } catch (e) {
    console.error("scene render failed", e);
    return NextResponse.json({ error: "Render failed." }, { status: 500 });
  }
}
