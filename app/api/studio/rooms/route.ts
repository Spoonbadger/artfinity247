// POST /api/studio/rooms { slug, scenes: number[] } : the artist's room picks for one artwork.
// scenes: 1–5 scene numbers (0–999), in display order. [] goes back to auto-picked rooms.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX = 5;

export async function POST(req: Request) {
  try {
    const { user, denied } = await activeUserGuard("Log in to keep going.");
    if (denied) return denied;

    const body = (await req.json().catch(() => null)) as { slug?: unknown; scenes?: unknown } | null;
    const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
    const raw = body?.scenes;
    if (!slug || !Array.isArray(raw)) return NextResponse.json({ error: "Pick a piece and some rooms.", code: "bad_request" }, { status: 400 });
    if (raw.length > MAX) return NextResponse.json({ error: `Up to ${MAX} rooms. Remove one first.`, code: "room_limit" }, { status: 400 });
    if (!raw.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 999)) {
      return NextResponse.json({ error: "That room isn't on the list any more. Refresh and pick again.", code: "bad_request" }, { status: 400 });
    }
    const scenes = Array.from(new Set(raw as number[]));

    const art = await prisma.artwork.findUnique({ where: { slug }, select: { id: true, artistId: true } });
    if (!art) return NextResponse.json({ error: "We couldn't find that piece. It may have been deleted.", code: "art_not_found" }, { status: 404 });
    if (art.artistId !== user.id) return NextResponse.json({ error: "Only the artist can pick rooms for this piece.", code: "not_your_art" }, { status: 403 });

    const saved = await prisma.artwork.update({ where: { id: art.id }, data: { roomScenes: scenes }, select: { roomScenes: true } });
    return NextResponse.json({ roomScenes: saved.roomScenes });
  } catch (e) {
    console.error("[studio/rooms]", e);
    return NextResponse.json({ error: "Couldn't save just now. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
