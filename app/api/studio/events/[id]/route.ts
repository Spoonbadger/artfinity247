// PATCH  /api/studio/events/:id { name?, venue?, start?, end? } : edit one of the artist's events.
// DELETE /api/studio/events/:id : remove it.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleanEvent, currentArtistId, eventSelect } from "../_lib";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

async function own(id: string, artistId: string) {
  return prisma.studioEvent.findFirst({ where: { id, artistId }, select: eventSelect });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const artistId = await currentArtistId();
  if (!artistId) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const current = await own(params.id, artistId);
  if (!current) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  const body = await req.json().catch(() => null);
  const r = cleanEvent(body, current);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
  const event = await prisma.studioEvent.update({ where: { id: current.id }, data: r.data, select: eventSelect });
  return NextResponse.json({ event });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const artistId = await currentArtistId();
  if (!artistId) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const { count } = await prisma.studioEvent.deleteMany({ where: { id: params.id, artistId } });
  if (!count) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
