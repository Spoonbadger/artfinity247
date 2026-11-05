// GET /api/studio/analytics?range=7|30|90: the signed-in artist's daily numbers as CSV.
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getArtistAnalytics, parseRange } from "@/lib/analytics";
import { sourceLabel } from "@/lib/pageviews";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => (typeof v === "number" ? String(v) : /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = (await requireUser()).id;
  } catch {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const range = parseRange(req.nextUrl.searchParams.get("range"));
  const a = await getArtistAnalytics(userId, range);
  const rows: (string | number)[][] = [
    ["date", "views", "visitors", "scans", "sales"],
    ...a.days.map((d) => [d.key, d.views, d.visitors, d.scans, d.sales]),
    [],
    ["source", "views", "visitors", "sales (QR only)"],
    ...a.sources.map((s) => [sourceLabel(s.source), s.views, s.visitors, s.sales ?? ""]),
    [],
    ["artwork", "views", "visitors", "sales"],
    ...a.artworks.map((w) => [w.title, w.views, w.visitors, w.sales]),
  ];
  const csv = rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artfinity-analytics-${range}d-${a.days[a.days.length - 1]?.key}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
