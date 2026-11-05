// POST /api/admin/scenes/preview { annotation, size, frame, mat, art, anchor } : the real compositor on an unsaved
// annotation, full photo, as a JPEG. Admin only.
import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { findPhoto } from "@/lib/scenes/catalog";
import { composite } from "@/lib/scenes/composite";
import { readArtImage } from "@/lib/scenes/server";
import { prisma } from "@/lib/prisma";
import { FRAME_KEYS, PRINT_SIZE_KEYS, type FrameKey, type PrintSizeKey, type SceneAnnotation } from "@/lib/scenes/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { annotation?: SceneAnnotation; size?: string; frame?: string; mat?: boolean; art?: string; anchor?: number } | null;
  const a = body?.annotation;
  const photo = a ? await findPhoto(a.id) : null;
  if (!a || !photo) return NextResponse.json({ error: "Unknown photo." }, { status: 404 });
  const size = (PRINT_SIZE_KEYS as string[]).includes(body?.size || "") ? (body!.size as PrintSizeKey) : "medium";
  const frame = (FRAME_KEYS as string[]).includes(body?.frame || "") ? (body!.frame as FrameKey) : "black";
  let url = "/seed/art-01.jpg";
  if (body?.art) {
    const art = await prisma.artwork.findUnique({ where: { slug: body.art }, select: { imageUrl: true } });
    if (art) url = art.imageUrl;
  }
  const img = await readArtImage(url);
  if (!img) return NextResponse.json({ error: "Artwork image unavailable." }, { status: 502 });
  try {
    const r = await composite({
      photo: { file: photo.file, ann: { ...a, image: { w: photo.w, h: photo.h } }, credit: photo.credit, id: photo.id },
      variant: { anchor: Math.max(0, Math.min((a.anchors?.length || 1) - 1, body?.anchor ?? 0)) },
      art: img,
      size,
      frame,
      mat: body?.mat !== false,
      width: Math.min(1600, photo.w),
    });
    return new NextResponse(new Uint8Array(r.jpeg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store", "X-Print-Size": r.rect.label.replace("×", "x"), "X-Ppi": String(r.rect.ppi), "X-Fits": r.rect.fits ? "1" : "0" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Render failed." }, { status: 400 });
  }
}
