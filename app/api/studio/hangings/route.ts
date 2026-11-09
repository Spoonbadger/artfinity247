// POST /api/studio/hangings { artworkIds: string[], place: { id } | { venueId } | { name } | null } → those paintings
// now hang at the Place (null = back home). One Place at a time; the move is kept in the painting's history.
// → { moved, place }
import { NextResponse } from "next/server";
import { hangArtworks, resolvePlace } from "@/lib/artistPlaces";
import { body, err, fail, strings } from "../places/_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const b = await body(req);
  const ids = strings(b?.artworkIds);
  if (!b || !ids.length) return err("Pick at least one painting.", "missing_art", 400);
  try {
    const place = await resolvePlace(artistId, b.place);
    if (typeof place === "string") return err(place, "place_not_found", 400);
    const moved = await hangArtworks(artistId, ids, place?.id ?? null);
    return NextResponse.json({ moved, place: place ? { id: place.id, name: place.name } : null });
  } catch (e) {
    return fail(e, "hang");
  }
}
