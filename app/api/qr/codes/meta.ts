// Input checks shared by the short link code routes.
import { prisma } from "@/lib/prisma";
import { sanitizeDesign } from "@/components/qr/card";
import { parseCodeDiscount } from "@/lib/shortcode";
import { codeMirror, ensurePlace, resolvePlace } from "@/lib/artistPlaces";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) || null : null);

export type CodeMeta = {
  artworkId?: string | null;
  label?: string | null;
  venue?: string | null;
  venueId?: string | null;
  placeId?: string | null;
  discountPct?: number | null;
  expiresAt?: Date | null;
  active?: boolean;
  design?: ReturnType<typeof sanitizeDesign>;
};

/**
 * Only the fields present in the body are returned, so PATCH changes just those.
 * artworkId / artworkSlug must be one of this artist's artworks; null means the artist's page.
 * Returns a string on a bad value.
 */
export async function parseMeta(body: Record<string, unknown>, artistId: string): Promise<CodeMeta | string> {
  const out: CodeMeta = {};
  if ("artworkId" in body || "artworkSlug" in body) {
    const id = typeof body.artworkId === "string" ? body.artworkId : null;
    const slug = typeof body.artworkSlug === "string" ? body.artworkSlug : null;
    if (!id && !slug) out.artworkId = null;
    else {
      const art = await prisma.artwork.findFirst({ where: { artistId, ...(id ? { id } : { slug }) }, select: { id: true } });
      if (!art) return "That artwork isn't yours.";
      out.artworkId = art.id;
    }
  }
  if ("label" in body) out.label = clean(body.label, 60);
  if ("venue" in body) out.venue = clean(body.venue, 60);
  // A partner venue (lib/venues.ts) sets both: venueId, and the venue text buyers see ("Scanned at ...").
  // null / "" unlinks it and keeps whatever venue text was sent ("Other place").
  if ("venueId" in body) {
    const id = typeof body.venueId === "string" && body.venueId ? body.venueId : null;
    if (!id) out.venueId = null;
    else {
      const v = await prisma.venue.findUnique({ where: { id }, select: { id: true, name: true } });
      if (!v) return "That venue isn't on the list any more.";
      out.venueId = v.id;
      out.venue = v.name.slice(0, 60);
    }
  }
  // Where it hangs. `place` ({ id } | { venueId } | { name } | null, from the Place picker) wins; the older venue /
  // venueId fields become the artist's Place too. Either way venue and venueId mirror the Place (lib/artistPlaces.ts).
  try {
    if ("place" in body) {
      const p = await resolvePlace(artistId, body.place);
      if (typeof p === "string") return p;
      Object.assign(out, codeMirror(p));
    } else if ("venue" in body || "venueId" in body) {
      const p = out.venueId ? await ensurePlace(artistId, { name: out.venue || "Venue", venueId: out.venueId }) : out.venue ? await ensurePlace(artistId, { name: out.venue }) : null;
      Object.assign(out, codeMirror(p));
    }
  } catch (e) {
    if ((e as { code?: string })?.code === "place_limit") return (e as Error).message;
    throw e;
  }
  if ("discountPct" in body) {
    const v = body.discountPct;
    if (v === null || v === 0 || v === "" || v === "0") out.discountPct = null;
    else {
      const d = parseCodeDiscount(v);
      if (d === null) return "Discounts run from 5% to 30%.";
      out.discountPct = d;
    }
  }
  if ("expiresAt" in body) {
    const v = body.expiresAt;
    if (v === null || v === "") out.expiresAt = null;
    else {
      const d = new Date(String(v));
      if (Number.isNaN(d.getTime())) return "That end date doesn't look right.";
      out.expiresAt = d;
    }
  }
  if ("active" in body) out.active = body.active !== false;
  if ("design" in body && body.design && typeof body.design === "object") out.design = sanitizeDesign(body.design);
  return out;
}
