// GET /api/admin/originals/:artworkId  The full-resolution original for printing. Admins only.
// ?src=<image url> picks the file an order was placed with, in case the artist has since replaced the image.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { originalResponse } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { artworkId: string } }) {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const art = await prisma.artwork.findUnique({ where: { id: params.artworkId }, select: { imageUrl: true, slug: true, id: true } });
  if (!art) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const src = req.nextUrl.searchParams.get("src");
  const ordered = !!src && src !== art.imageUrl && (await prisma.orderItem.count({ where: { artworkId: art.id, imageUrl: src } })) > 0;
  return originalResponse(ordered ? src! : art.imageUrl, art.slug || art.id);
}
