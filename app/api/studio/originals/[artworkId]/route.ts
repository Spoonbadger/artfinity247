// GET /api/studio/originals/:artworkId  The artist's own full-resolution original.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { originalResponse } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { artworkId: string } }) {
  const user = await requireUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const art = await prisma.artwork.findUnique({ where: { id: params.artworkId }, select: { imageUrl: true, slug: true, id: true, artistId: true } });
  if (!art || art.artistId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return originalResponse(art.imageUrl, art.slug || art.id);
}
