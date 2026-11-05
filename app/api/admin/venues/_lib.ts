// Input checks shared by the admin venue routes.
import { prisma } from "@/lib/prisma";
import { MAX_SHARE_PCT, venueKey } from "@/lib/venues";

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, " ").trim().slice(0, max) || null : null);

export type VenueFields = {
  name?: string;
  neighborhood?: string | null;
  address?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  sharePct?: number;
  active?: boolean;
  notes?: string | null;
};

/**
 * Only fields present in the body are returned (PATCH changes just those). The form sends sharePct as a percent
 * ("5" = 5%); it's stored as a fraction of Artfinity's profit (0.05). Returns a string on a bad value.
 */
export function parseVenue(body: Record<string, unknown>, creating: boolean): VenueFields | string {
  const out: VenueFields = {};
  if ("name" in body || creating) {
    const name = clean(body.name, 80);
    if (!name) return "Give the venue a name.";
    out.name = name;
  }
  if ("neighborhood" in body) out.neighborhood = clean(body.neighborhood, 60);
  if ("address" in body) out.address = clean(body.address, 160);
  if ("contactName" in body) out.contactName = clean(body.contactName, 80);
  if ("contactEmail" in body) {
    const e = clean(body.contactEmail, 120);
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return "That contact email doesn't look right.";
    out.contactEmail = e ? e.toLowerCase() : null;
  }
  if ("sharePct" in body) {
    const raw = body.sharePct;
    const n = raw === "" || raw === null || raw === undefined ? 0 : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > MAX_SHARE_PCT * 100) return `Share runs from 0% to ${MAX_SHARE_PCT * 100}% of Artfinity's profit.`;
    out.sharePct = Math.round(n * 100) / 10000; // 2 decimals of a percent
  }
  if ("active" in body) out.active = body.active !== false && body.active !== "false";
  if ("notes" in body) out.notes = typeof body.notes === "string" ? body.notes.replace(/[\u0000-\u0009\u000b-\u001f<>]/g, " ").trim().slice(0, 2000) || null : null;
  return out;
}

/** Links matching unlinked codes; returns how many. */
export async function linkVenueText(text: string, venueId: string, venueName: string) {
  const key = venueKey(text);
  if (!key) return 0;
  const rows = await prisma.qrCode.findMany({ where: { venueId: null, venue: { not: null } }, select: { id: true, venue: true } });
  const ids = rows.filter((r) => venueKey(r.venue || "") === key).map((r) => r.id);
  if (!ids.length) return 0;
  const res = await prisma.qrCode.updateMany({ where: { id: { in: ids } }, data: { venueId, venue: venueName.slice(0, 60) } });
  return res.count;
}
