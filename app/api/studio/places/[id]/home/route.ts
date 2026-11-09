// POST /api/studio/places/:id/home { artworkIds?: string[] } → "Back home": those paintings (all of them when left out)
// stop hanging at this Place. Their history keeps the dates. → { moved }
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { body, err, me, strings } from "../../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  const place = await prisma.place.findFirst({ where: { id: params.id, artistId }, select: { id: true } });
  if (!place) return err("That place is gone. Refresh to see your list.", "place_not_found", 404);
  const ids = strings((await body(req))?.artworkIds);
  const r = await prisma.hanging.updateMany({ where: { artistId, placeId: place.id, endedAt: null, ...(ids.length ? { artworkId: { in: ids } } : {}) }, data: { endedAt: new Date() } });
  return NextResponse.json({ moved: r.count });
}
