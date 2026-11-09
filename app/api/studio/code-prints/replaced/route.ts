// POST /api/studio/code-prints/replaced { codes: string[] } → "Mark old labels as replaced" (reprinted, or taken off
// the wall): their printed labels stop counting as out of date. → { ids } (for Undo)
// POST /api/studio/code-prints/replaced { undo: string[] } → puts those back. → { restored }
import { NextResponse } from "next/server";
import { markReplaced, unmarkReplaced } from "@/lib/labelStatus";
import { normalizeCode } from "@/lib/shortcode";
import { body, err, strings } from "../../places/_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const b = await body(req);
  if (!b) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
  if (Array.isArray(b.undo)) return NextResponse.json({ restored: await unmarkReplaced(artistId, strings(b.undo)) });
  const codes = strings(b.codes).map((c) => normalizeCode(c)).filter((c): c is string => !!c);
  if (!codes.length) return err("Pick at least one code.", "bad_request", 400);
  const ids = await markReplaced(artistId, codes);
  if (!ids.length) return err("Nothing to mark. Those labels are already up to date.", "labels_current", 409);
  return NextResponse.json({ ids });
}
