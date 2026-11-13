// POST /api/studio/places/:id/move { to: { id } | { venueId } | { name } } → "Move everything to another place":
// its codes, the paintings hanging there and its queued print jobs. → { codes, paintings, to }
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { moveEverything, resolvePlace } from "@/lib/artistPlaces";
import { body, err, fail } from "../../_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const from = await prisma.place.findFirst({ where: { id: params.id, artistId }, select: { id: true } });
  if (!from) return err("That place is gone. Refresh to see your list.", "place_not_found", 404);
  const b = await body(req);
  try {
    const to = await resolvePlace(artistId, b?.to);
    if (typeof to === "string") return err(to, "place_not_found", 400);
    if (!to) return err("Pick where everything goes.", "bad_request", 400);
    if (to.id === from.id) return err("Pick a different place.", "bad_request", 400);
    const moved = await moveEverything(artistId, from.id, to);
    return NextResponse.json({ ...moved, to: { id: to.id, name: to.name } });
  } catch (e) {
    return fail(e, "move");
  }
}
