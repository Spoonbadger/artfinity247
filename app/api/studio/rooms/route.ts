// POST /api/studio/rooms { slug, scenes: number[] } : the artist's room picks for one artwork.
// scenes: 1–5 scene numbers (0–999), in display order. [] goes back to auto-picked rooms.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX = 5;

export async function POST(req: Request) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { slug?: unknown; scenes?: unknown } | null;
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const raw = body?.scenes;
  if (!slug || !Array.isArray(raw)) return NextResponse.json({ error: "Pick a piece and some rooms." }, { status: 400 });
  if (raw.length > MAX) return NextResponse.json({ error: `Up to ${MAX} rooms.` }, { status: 400 });
  if (!raw.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 999)) {
    return NextResponse.json({ error: "Unknown room." }, { status: 400 });
  }
  const scenes = Array.from(new Set(raw as number[]));

  const art = await prisma.artwork.findUnique({ where: { slug }, select: { id: true, artistId: true } });
  if (!art) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });
  if (art.artistId !== user.id) return NextResponse.json({ error: "Only the artist can pick rooms." }, { status: 403 });

  const saved = await prisma.artwork.update({ where: { id: art.id }, data: { roomScenes: scenes }, select: { roomScenes: true } });
  return NextResponse.json({ roomScenes: saved.roomScenes });
}
