// POST /api/admin/venues/<id>/payout { month, unmark?, note? } — "Mark paid": records the venue's share for the month as paid.
// No table of its own: an AdminAction (lib/audit.ts) "venue.payout_paid" with { month, amountCents } (lib/venues.ts).
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { isMonth, monthLabel, venuePayouts, venueStatement, VENUE_PAID_ACTION, VENUE_UNPAID_ACTION } from "@/lib/venues";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Money: owner and admin only (lib/adminRoles.ts).
  const { admin, denied } = await adminRoleGuard("money");
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { month?: unknown; unmark?: unknown; note?: unknown } | null;
  const month = body?.month;
  if (!isMonth(month)) return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  const s = await venueStatement(params.id, month);
  if (!s) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const paid = (await venuePayouts(s.venue.id)).get(month);
  const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) : "";

  if (body?.unmark === true) {
    if (!paid) return NextResponse.json({ error: "That month isn't marked paid." }, { status: 409 });
    await logAdminAction(admin, VENUE_UNPAID_ACTION, { type: "venue", id: s.venue.id }, `Unmarked ${s.venue.name}'s ${monthLabel(month)} share as paid (was ${usd(paid.amountCents)})`, {
      month, amountCents: paid.amountCents, note,
    });
    return NextResponse.json({ message: "Marked unpaid" });
  }
  if (paid) return NextResponse.json({ error: `Already marked paid (${usd(paid.amountCents)}).` }, { status: 409 });
  const amountCents = s.totals.owedCents;
  if (amountCents <= 0) return NextResponse.json({ error: "Nothing is owed for that month." }, { status: 409 });
  await logAdminAction(admin, VENUE_PAID_ACTION, { type: "venue", id: s.venue.id }, `Paid ${s.venue.name} ${usd(amountCents)} venue share for ${monthLabel(month)}`, {
    month, amountCents, sharePct: s.venue.sharePct, artfinityCents: s.totals.artfinityCents, sales: s.totals.sales, note,
  });
  return NextResponse.json({ message: `Marked ${usd(amountCents)} paid for ${monthLabel(month)}` });
}
