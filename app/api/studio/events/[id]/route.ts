// PATCH  /api/studio/events/:id { name?, venue?, start?, end? } : edit one of the artist's events.
// DELETE /api/studio/events/:id : remove it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanEvent, eventSelect, placeForEvent } from "../_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function own(id: string, artistId: string) {
  return prisma.studioEvent.findFirst({ where: { id, artistId }, select: eventSelect });
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
    if (denied) return denied;
    const artistId = user.id;
    const current = await own(params.id, artistId);
    if (!current) return NextResponse.json({ error: "That event is gone. Refresh to see your list.", code: "event_not_found" }, { status: 404 });
    const body = await req.json().catch(() => null);
    const r = cleanEvent(body, current);
    if ("error" in r) return NextResponse.json({ error: r.error, code: "invalid_event" }, { status: 400 });
    // A new name can mean a different Place.
    const placeId = r.data.name !== current.name ? await placeForEvent(artistId, r.data) : undefined;
    const event = await prisma.studioEvent.update({ where: { id: current.id }, data: { ...r.data, ...(placeId !== undefined ? { placeId } : {}) }, select: eventSelect });
    return NextResponse.json({ event });
  } catch (e) {
    console.error("[studio/events]", e);
    return NextResponse.json({ error: "Couldn't save just now. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
    if (denied) return denied;
    const artistId = user.id;
    const { count } = await prisma.studioEvent.deleteMany({ where: { id: params.id, artistId } });
    if (!count) return NextResponse.json({ error: "That event is gone. Refresh to see your list.", code: "event_not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[studio/events]", e);
    return NextResponse.json({ error: "Couldn't save just now. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
