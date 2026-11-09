// POST /api/studio/codes/place { codes: string[], place: { id } | { venueId } | { name } | null } → moves codes to a
// Place (made when it's a partner venue or a new name), or out of any Place. → { moved, place, before }
// `before` maps each code to its old Place id, so Undo can put them back ({ restore: before }).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { codeMirror, resolvePlace } from "@/lib/artistPlaces";
import { normalizeCode } from "@/lib/shortcode";
import { body, err, fail, me, strings } from "../../places/_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const artistId = await me();
  if (!artistId) return err("Log in to keep going.", "not_logged_in", 401);
  const b = await body(req);
  if (!b) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
  try {
    // Undo: each code back to the Place it had.
    if (b.restore && typeof b.restore === "object") {
      const entries = Object.entries(b.restore as Record<string, unknown>).slice(0, 500);
      const places = await prisma.place.findMany({ where: { artistId, id: { in: entries.map(([, v]) => v).filter((v): v is string => typeof v === "string") } }, select: { id: true, name: true, venueId: true } });
      const byId = new Map(places.map((p) => [p.id, p]));
      for (const [code, pid] of entries) {
        await prisma.qrCode.updateMany({ where: { artistId, code }, data: codeMirror(typeof pid === "string" ? byId.get(pid) ?? null : null) });
      }
      return NextResponse.json({ restored: entries.length });
    }
    const codes = strings(b.codes).map((c) => normalizeCode(c)).filter((c): c is string => !!c);
    if (!codes.length) return err("Pick at least one code.", "bad_request", 400);
    const place = await resolvePlace(artistId, b.place);
    if (typeof place === "string") return err(place, "place_not_found", 400);
    const rows = await prisma.qrCode.findMany({ where: { artistId, code: { in: codes } }, select: { id: true, code: true, placeId: true } });
    if (!rows.length) return err("We couldn't find those codes.", "code_not_found", 404);
    await prisma.qrCode.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: codeMirror(place) });
    return NextResponse.json({ moved: rows.length, place: place ? { id: place.id, name: place.name } : null, before: Object.fromEntries(rows.map((r) => [r.code, r.placeId])) });
  } catch (e) {
    return fail(e, "assign codes");
  }
}
