// POST /api/admin/venues/link { text, venueId } — "Link to venue": every code with no venue partner whose free-text
// venue matches `text` (case and accents ignored) now hangs at that venue. Its venue text becomes the venue's name.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { linkVenueText } from "../_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("accounts");
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { text?: unknown; venueId?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";
  const venueId = typeof body?.venueId === "string" ? body.venueId : "";
  if (!text.trim() || !venueId) return NextResponse.json({ error: "Pick a venue." }, { status: 400 });
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { id: true, name: true } });
  if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const linked = await linkVenueText(text, venue.id, venue.name);
  if (!linked) return NextResponse.json({ error: "No unlinked codes use that name any more." }, { status: 409 });
  await logAdminAction(admin, "venue.link_codes", { type: "venue", id: venue.id }, `Linked ${linked} codes named "${text.trim()}" to ${venue.name}`, { text: text.trim(), linked });
  return NextResponse.json({ linked, message: `Linked ${linked} ${linked === 1 ? "code" : "codes"} to ${venue.name}` });
}
