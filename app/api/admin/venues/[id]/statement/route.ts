// GET  /api/admin/venues/<id>/statement?month=YYYY-MM   → the month's statement as CSV
// POST /api/admin/venues/<id>/statement { month }       → email it to the venue's contact (money: owner/admin)
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { resend } from "@/lib/resend";
import { SITE_URL } from "@/lib/urls";
import { isMonth, monthLabel, pctLabel, statementCsv, venueStatement, VENUE_STATEMENT_ACTION } from "@/lib/venues";
import VenueStatementEmail from "@/emails/VenueStatementEmail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { denied } = await adminRoleGuard("view");
  if (denied) return denied;
  const month = req.nextUrl.searchParams.get("month");
  if (!isMonth(month)) return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  const s = await venueStatement(params.id, month);
  if (!s) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  return new NextResponse(statementCsv(s), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artfinity-${s.venue.slug}-${month}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await adminRoleGuard("money");
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as { month?: unknown } | null;
  const month = body?.month;
  if (!isMonth(month)) return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 });
  const s = await venueStatement(params.id, month);
  if (!s) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const to = s.venue.contactEmail;
  if (!to) return NextResponse.json({ error: "Add a contact email for this venue first." }, { status: 400 });

  const t = s.totals;
  const label = monthLabel(month);
  const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM || "Artfinity <contact@theartfinity.com>",
    to,
    subject: `Your Artfinity statement for ${label}: ${s.venue.name}`,
    react: VenueStatementEmail({
      venueName: s.venue.name,
      contactName: s.venue.contactName,
      monthLabel: label,
      sharePct: s.venue.sharePct > 0 ? pctLabel(s.venue.sharePct) : null,
      sales: t.sales,
      grossCents: t.grossCents,
      owedCents: t.owedCents,
      paid: !!t.paid,
      pageUrl: `${SITE_URL}/venues/${s.venue.slug}`,
      lines: s.lines.filter((l) => !l.refunded).map((l) => ({ date: l.date.toISOString().slice(0, 10), title: l.title, artist: l.artist, amount: usd(l.grossCents) })),
    }),
  });
  if (error) return NextResponse.json({ error: "The email didn't send. Try again." }, { status: 502 });
  await logAdminAction(admin, VENUE_STATEMENT_ACTION, { type: "venue", id: s.venue.id }, `Emailed ${s.venue.name} its ${label} statement (${usd(t.owedCents)} share)`, {
    month, to, owedCents: t.owedCents, sales: t.sales,
  });
  return NextResponse.json({ message: `Statement sent to ${to}` });
}
