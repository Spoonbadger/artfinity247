// POST /api/studio/places/:id/home { artworkIds?: string[] } → "Back home": those paintings (all of them when left out)
// stop hanging at this Place. Their history keeps the dates. → { moved }
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { body, err, strings } from "../../_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const place = await prisma.place.findFirst({ where: { id: params.id, artistId }, select: { id: true } });
  if (!place) return err("That place is gone. Refresh to see your list.", "place_not_found", 404);
  const ids = strings((await body(req))?.artworkIds);
  const r = await prisma.hanging.updateMany({ where: { artistId, placeId: place.id, endedAt: null, ...(ids.length ? { artworkId: { in: ids } } : {}) }, data: { endedAt: new Date() } });
  return NextResponse.json({ moved: r.count });
}
