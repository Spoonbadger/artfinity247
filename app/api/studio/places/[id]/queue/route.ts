// POST /api/studio/places/:id/queue → "Print all codes for this place": its codes (and a new one for each painting
// hanging there without one) go into the print queue, tagged to the Place. → { queued, made, cards }
import { NextResponse } from "next/server";
import { queueForPlace } from "@/lib/artistPlaces";
import { queueCount } from "@/lib/printQueue";
import { err, me } from "../../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  try {
    const r = await queueForPlace(artistId, params.id);
    if (!r) return err("That place is gone. Refresh to see your list.", "place_not_found", 404);
    if (!r.queued) return err("Nothing to print here yet. Hang a painting or move a code here first.", "place_empty", 404);
    return NextResponse.json({ queued: r.queued, made: r.made, cards: await queueCount(artistId) });
  } catch (e) {
    if ((e as { code?: string })?.code === "queue_full") return err((e as Error).message, "queue_full", 409);
    console.error("[places] queue failed", e);
    return err("Couldn't add them to your print queue. Try again.", "server_error", 500);
  }
}
