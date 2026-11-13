// GET  /api/studio/events : the signed-in artist's events, by start date.
// POST /api/studio/events { name, venue?, start, end? } : add one.
// POST /api/studio/events { events: [...] } : one-time upload of events saved in the browser
//   before they moved to the server. Only runs while the artist has no events yet.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanEvent, currentArtistId, eventSelect, MAX_EVENTS, placeForEvent, type EventInput } from "./_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

const list = (artistId: string) =>
  prisma.studioEvent.findMany({ where: { artistId }, orderBy: [{ start: "asc" }, { createdAt: "asc" }], select: eventSelect });

export async function GET() {
  try {
    const artistId = await currentArtistId();
    if (!artistId) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
    return NextResponse.json({ events: await list(artistId) });
  } catch (e) {
    console.error("[studio/events]", e);
    return NextResponse.json({ error: "Couldn't save just now. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
    if (denied) return denied;
    const artistId = user.id;
    const body = await req.json().catch(() => null);

    if (body && Array.isArray(body.events)) {
      const existing = await prisma.studioEvent.count({ where: { artistId } });
      if (existing > 0) return NextResponse.json({ events: await list(artistId), imported: 0 });
      const rows: EventInput[] = [];
      for (const raw of body.events.slice(0, MAX_EVENTS)) {
        const r = cleanEvent(raw);
        if ("data" in r) rows.push(r.data);
      }
      if (rows.length) await prisma.studioEvent.createMany({ data: rows.map((r) => ({ ...r, artistId })) });
      return NextResponse.json({ events: await list(artistId), imported: rows.length });
    }

    const r = cleanEvent(body);
    if ("error" in r) return NextResponse.json({ error: r.error, code: "invalid_event" }, { status: 400 });
    const count = await prisma.studioEvent.count({ where: { artistId } });
    if (count >= MAX_EVENTS) return NextResponse.json({ error: "That's a lot of events. Remove some old ones first.", code: "event_limit" }, { status: 400 });
    const event = await prisma.studioEvent.create({ data: { ...r.data, artistId, placeId: await placeForEvent(artistId, r.data) }, select: eventSelect });
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    console.error("[studio/events]", e);
    return NextResponse.json({ error: "Couldn't save just now. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
