// PATCH /api/admin/venues/<id> { name?, neighborhood?, address?, contactName?, contactEmail?, sharePct? (percent), active?, notes? }
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { pctLabel, uniqueVenueSlug } from "@/lib/venues";
import { parseVenue } from "../_lib";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await adminRoleGuard("accounts");
  if (denied) return denied;
  const before = await prisma.venue.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const f = parseVenue(body, false);
  if (typeof f === "string") return NextResponse.json({ error: f }, { status: 400 });
  // Changing the share is a money decision: owner and admin only (lib/adminRoles.ts).
  const shareChanged = f.sharePct !== undefined && Math.abs(f.sharePct - before.sharePct) > 1e-9;
  if (shareChanged) {
    const money = await adminRoleGuard("money");
    if (money.denied) return money.denied;
  } else delete f.sharePct;
  // Renaming keeps the public link unless the new name gives a different slug.
  const slug = f.name && f.name !== before.name ? await uniqueVenueSlug(f.name, before.id) : before.slug;
  const venue = await prisma.venue.update({ where: { id: before.id }, data: { ...f, slug } });
  // Codes hanging there show the venue's name to buyers ("Scanned at ...").
  if (f.name && f.name !== before.name) await prisma.qrCode.updateMany({ where: { venueId: venue.id }, data: { venue: f.name.slice(0, 60) } });

  const changed = (Object.keys(f) as (keyof typeof f)[]).filter((k) => f[k] !== (before as Record<string, unknown>)[k]);
  if (changed.length) {
    const summary = shareChanged ? `Venue ${venue.name}: share ${pctLabel(before.sharePct)} → ${pctLabel(venue.sharePct)}` : `Edited venue ${venue.name} (${changed.join(", ")})`;
    await logAdminAction(admin, shareChanged ? "venue.share_change" : "venue.update", { type: "venue", id: venue.id }, summary, {
      changed: Object.fromEntries(changed.map((k) => [k, { from: (before as Record<string, unknown>)[k] ?? null, to: f[k] ?? null }])),
    });
  }
  return NextResponse.json({ venue, message: "Saved" });
}
