import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { getBalance, type LedgerStatus } from "@/lib/balance";
import { bucketOf, type MoneyBucket } from "@/components/money/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const csv = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const dollars = (c: number) => (c / 100).toFixed(2);

/** CSV of the artist's transactions. Optional ?bucket=hold|ready|paid (the page's filter), ?status=pending|available|paid and ?q=. */
export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as LedgerStatus | null;
  const bucket = searchParams.get("bucket") as MoneyBucket | null;
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  const b = await getBalance(user.id);
  const rows = b.ledger.filter((l) =>
    (!status || l.status === status) &&
    (!bucket || bucketOf(l, b.currentMonth) === bucket) &&
    (!q || [l.title, l.buyerFirst, l.buyerCity, l.size].join(" ").toLowerCase().includes(q))
  );

  const header = ["date", "artwork", "size", "framed", "qty", "buyer", "city", "gross_usd", "printing_usd", "fees_usd", "profit_usd", "split_pct", "your_share_usd", "status", "payout_month", "clears_on", "source", "refunded"];
  const lines = [header.join(",")];
  for (const l of rows) {
    lines.push([
      l.date.slice(0, 10), csv(l.title), l.size, l.framed ? "yes" : "no", l.quantity, csv(l.buyerFirst), csv(l.buyerCity),
      dollars(l.grossCents), dollars(l.printingCents), dollars(l.feesCents), dollars(l.profitCents),
      Math.round(l.split * 100), dollars(l.shareCents), l.status, l.payoutMonth, l.clearsAt.slice(0, 10), csv(l.source || ""), l.refunded ?? "",
    ].join(","));
  }
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artfinity-transactions-${b.now.slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
