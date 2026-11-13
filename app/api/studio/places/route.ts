// GET  /api/studio/places → { places } the artist's Places for pickers.
// POST /api/studio/places { name, kind?, area?, venueId?, startsOn?, endsOn? } → { place } (201)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_PLACES, parsePlace, placeOptions, type PlaceFields } from "@/lib/artistPlaces";
import { body, err, fail, me } from "./_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  return NextResponse.json({ places: await placeOptions(artistId) });
}

export async function POST(req: Request) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const b = await body(req);
  if (!b) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
  const f = await parsePlace(b, true);
  if (typeof f === "string") return err(f, "invalid_place", 400);
  try {
    if ((await prisma.place.count({ where: { artistId } })) >= MAX_PLACES) return err("That's a lot of places. Remove some old ones first.", "place_limit", 400);
    const { active: _a, afterEnd: _e, ...fields } = f as PlaceFields & { name: string };
    const place = await prisma.place.create({ data: { artistId, ...fields, name: fields.name! }, select: { id: true, name: true } });
    return NextResponse.json({ place }, { status: 201 });
  } catch (e) {
    return fail(e, "create");
  }
}
