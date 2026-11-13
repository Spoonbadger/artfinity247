// POST /api/studio/print-queue/place { place: { id } | { venueId } | { name } | null } → "Printing these for a place":
// every code in the queue is tagged to that Place (and hangs there from now on); null untags them. → { tagged, place }
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignCodes, resolvePlace } from "@/lib/artistPlaces";
import { body, err, fail } from "../../places/_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const b = await body(req);
  if (!b) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
  try {
    const place = await resolvePlace(artistId, b.place);
    if (typeof place === "string") return err(place, "place_not_found", 400);
    const items = await prisma.printQueueItem.findMany({ where: { artistId }, select: { id: true, qrCodeId: true } });
    if (!items.length) return err("Your print queue is empty.", "queue_empty", 404);
    await prisma.printQueueItem.updateMany({ where: { artistId }, data: { placeId: place?.id ?? null } });
    if (place) await assignCodes(artistId, Array.from(new Set(items.map((i) => i.qrCodeId))), place);
    return NextResponse.json({ tagged: items.length, place: place ? { id: place.id, name: place.name } : null });
  } catch (e) {
    return fail(e, "tag queue");
  }
}
