// GET /api/rooms/:scene?art=<slug>&size=medium&frame=black&w=1200 : a PNG of one room with the print hung at true size.
// For share cards and Open Graph images. Only approved artworks.
import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { ASPECT, isScene, renderScene, sceneInfo, type RoomFrame, type RoomSize } from "@/lib/rooms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIZES: RoomSize[] = ["small", "medium", "large", "xl"];
const FRAMES: RoomFrame[] = ["black", "white", "natural"];

async function loadImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("/")) {
      const pub = path.join(process.cwd(), "public");
      const file = path.normalize(path.join(pub, decodeURIComponent(url.split("?")[0])));
      if (!file.startsWith(pub + path.sep)) return null;
      return await readFile(file);
    }
    if (!/^https:\/\//.test(url)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function GET(req: Request, { params }: { params: { scene: string } }) {
  const n = Number(params.scene);
  if (!isScene(n)) return NextResponse.json({ error: "Scene is 0 to 999." }, { status: 400 });
  const q = new URL(req.url).searchParams;
  const slug = q.get("art") || "";
  const size = (SIZES as string[]).includes(q.get("size") || "") ? (q.get("size") as RoomSize) : "medium";
  const frame = (FRAMES as string[]).includes(q.get("frame") || "") ? (q.get("frame") as RoomFrame) : null;
  const w = Math.min(2000, Math.max(320, Math.round(Number(q.get("w")) || 1200)));

  const art = slug ? await prisma.artwork.findUnique({ where: { slug }, select: { imageUrl: true, title: true, status: true, sensitive: true } }) : null;
  if (!art || art.status !== "APPROVED") return NextResponse.json({ error: "Artwork not found." }, { status: 404 });

  const buf = await loadImage(art.imageUrl);
  if (!buf) return NextResponse.json({ error: "Image unavailable." }, { status: 502 });
  // embed a modest copy of the image: the print is a small part of the frame
  const img = sharp(buf).rotate();
  const meta = await img.metadata();
  const small = await img.resize({ width: 900, height: 900, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  const aspect = meta.width && meta.height ? (meta.orientation && meta.orientation >= 5 ? meta.height / meta.width : meta.width / meta.height) : 0.8;
  const href = `data:image/jpeg;base64,${small.toString("base64")}`;

  const svg = renderScene(n, { href, aspect, size, frame, blur: (art.sensitive || []).length > 0 }, { width: w, height: Math.round(w / ASPECT), title: `${art.title}, ${sceneInfo(n).label}` });
  const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 8 }).toBuffer();
  return new NextResponse(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
  });
}
