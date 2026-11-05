// GET /api/admin/bookkeeping?month=YYYY-MM (or ?from=&to=)  The month's books as CSV (lib/bookkeeping.ts), the same file the
// bookkeeping job emails the owners on the 1st. Owner or admin with the money capability.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { booksCsv, buildBooks, monthBounds } from "@/lib/bookkeeping";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { denied } = await adminRoleGuard("money");
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") || "";
  // Or any window: ?from=<ISO date>&to=<ISO date> (e.g. to compare with the dashboard's 30 days).
  const from = sp.get("from") ? new Date(sp.get("from")!) : null;
  const to = sp.get("to") ? new Date(sp.get("to")!) : new Date();
  const range = from && !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from < to ? { start: from, end: to } : monthBounds(month);
  if (!range) return NextResponse.json({ error: "Use ?month=YYYY-MM (or ?from=&to=)" }, { status: 400 });
  const books = await buildBooks(range, from ? null : month);
  const name = from ? `${range.start.toISOString().slice(0, 10)}_${range.end.toISOString().slice(0, 10)}` : month;
  if (sp.get("format") === "json") return NextResponse.json({ month: books.month, start: range.start, end: range.end, totals: books.totals, lines: books.lines.length });
  return new Response(booksCsv(books), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artfinity-books-${name}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
