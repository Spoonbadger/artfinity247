// GET /api/admin/artists/export?<same filters as /admin/artists>  The artists list as CSV.
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { ARTIST_FILTER_KEYS, listArtists } from "@/lib/adminArtists";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const p = req.nextUrl.searchParams;
  const rows = await listArtists(Object.fromEntries(ARTIST_FILTER_KEYS.map((k) => [k, p.get(k) || ""])));
  const header = ["id", "name", "handle", "email", "city", "joined", "verification", "suspended", "closed", "plan", "infinity_until", "payouts", "live_artworks", "prints_sold", "sales_usd", "unpaid_usd"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([
      r.id, r.name, r.slug, r.email, r.city, r.createdAt.toISOString().slice(0, 10), r.verification, r.suspended ? "yes" : "", r.closed ? "yes" : "",
      r.infinity ? "Infinity" : "Free", r.proUntil ? r.proUntil.toISOString().slice(0, 10) : "",
      r.stripe === "ready" ? "stripe" : r.stripe === "pending" ? "stripe (unfinished)" : r.venmo ? "venmo" : "none",
      r.live, r.prints, (r.salesCents / 100).toFixed(2), (r.balanceCents / 100).toFixed(2),
    ].map(cell).join(","));
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artfinity-artists-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
