// POST /api/admin/venues { name, neighborhood?, address?, contactName?, contactEmail?, sharePct? (percent), active?, notes?, fromText? }
// Creates a partner venue. fromText ("Create venue from this"): also links every unlinked code whose venue text matches.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { pctLabel, uniqueVenueSlug } from "@/lib/venues";
import { linkVenueText, parseVenue } from "./_lib";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("accounts");
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const f = parseVenue(body, true);
  if (typeof f === "string") return NextResponse.json({ error: f }, { status: 400 });
  // A share of profit is money: owner and admin only (lib/adminRoles.ts).
  if (f.sharePct) {
    const money = await adminRoleGuard("money");
    if (money.denied) return money.denied;
  }
  const venue = await prisma.venue.create({
    data: { ...f, name: f.name!, slug: await uniqueVenueSlug(f.name!) },
    select: { id: true, name: true, slug: true, sharePct: true },
  });
  let linked = 0;
  if (typeof body.fromText === "string" && body.fromText.trim()) linked = await linkVenueText(body.fromText, venue.id, venue.name);
  await logAdminAction(admin, "venue.create", { type: "venue", id: venue.id }, `Added venue ${venue.name} (${pctLabel(venue.sharePct)} share)${linked ? `, linked ${linked} codes` : ""}`, { ...f, linked });
  return NextResponse.json({ venue, linked, message: linked ? `Added ${venue.name} and linked ${linked} ${linked === 1 ? "code" : "codes"}` : `Added ${venue.name}` });
}
