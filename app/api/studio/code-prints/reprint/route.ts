// POST /api/studio/code-prints/reprint { codes: string[] } → "Reprint" / "Save and reprint": puts those codes back in
// the print queue with their last printed look and today's discount. → { queued, cards }
import { NextResponse } from "next/server";
import { reprintCodes } from "@/lib/labelStatus";
import { queueCount } from "@/lib/printQueue";
import { normalizeCode } from "@/lib/shortcode";
import { body, err, me, strings } from "../../places/_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  const b = await body(req);
  const codes = strings(b?.codes, 200).map((c) => normalizeCode(c)).filter((c): c is string => !!c);
  if (!codes.length) return err("Pick at least one code.", "bad_request", 400);
  try {
    const queued = await reprintCodes(artistId, codes);
    if (!queued) return err("Those codes don't open a painting, so there's no card to reprint.", "code_not_found", 404);
    return NextResponse.json({ queued, cards: await queueCount(artistId) });
  } catch (e) {
    if ((e as { code?: string })?.code === "queue_full") return err((e as Error).message, "queue_full", 409);
    console.error("[code-prints] reprint failed", e);
    return err("Couldn't add them to your print queue. Try again.", "server_error", 500);
  }
}
