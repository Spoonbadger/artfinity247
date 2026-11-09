// PATCH  /api/studio/places/:id { name?, kind?, area?, venueId?, startsOn?, endsOn?, active?, afterEnd? }
//   Edit a Place. active false = "This place closed / show ended" (with afterEnd: what scans of its codes do now:
//   art | page | pause); active true reopens it. Its codes follow a new name or partner venue. → { place, before }
//   `before` is the state it replaced, so Undo can send it straight back.
// DELETE /api/studio/places/:id → its codes keep working without a Place; its paintings come home.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deletePlace, parsePlace, syncPlaceCodes } from "@/lib/artistPlaces";
import { body, err, fail, me } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };
const select = { id: true, name: true, kind: true, area: true, venueId: true, startsOn: true, endsOn: true, active: true, afterEnd: true, closedAt: true } as const;

export async function PATCH(req: Request, { params }: Ctx) {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  const before = await prisma.place.findFirst({ where: { id: params.id, artistId }, select });
  if (!before) return err("That place is gone. Refresh to see your list.", "place_not_found", 404);
  const b = await body(req);
  if (!b) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
  const f = await parsePlace(b, false);
  if (typeof f === "string") return err(f, "invalid_place", 400);
  if (f.startsOn !== undefined || f.endsOn !== undefined) {
    const s = f.startsOn !== undefined ? f.startsOn : before.startsOn, e = f.endsOn !== undefined ? f.endsOn : before.endsOn;
    if (s && e && e < s) return err("The last day is before the first.", "invalid_place", 400);
  }
  try {
    const closedAt = f.active === false ? (before.active ? new Date() : before.closedAt) : f.active === true ? null : undefined;
    const place = await prisma.place.update({ where: { id: before.id }, data: { ...f, ...(closedAt !== undefined ? { closedAt } : {}) }, select });
    if (place.name !== before.name || place.venueId !== before.venueId) await syncPlaceCodes(place);
    return NextResponse.json({ place, before: { active: before.active, afterEnd: before.afterEnd, endsOn: before.endsOn } });
  } catch (e) {
    return fail(e, "update");
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  try {
    if (!(await deletePlace(artistId, params.id))) return err("That place is gone. Refresh to see your list.", "place_not_found", 404);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e, "delete");
  }
}
