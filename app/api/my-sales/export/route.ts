// app/api/my-sales/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { itemBreakdown } from "@/lib/sales";

export const dynamic = "force-dynamic"
export const runtime = "nodejs";

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toDollars = (cents: number) => (cents / 100).toFixed(2);

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to export your sales.", code: "not_logged_in" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year"); // "2025" or null

  // Optional year filter
  let createdAtFilter: any = undefined;
  if (year && /^\d{4}$/.test(year)) {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`);
    createdAtFilter = { gte: start, lt: end };
  }

  const items = await prisma.orderItem.findMany({
    where: {
      artwork: { artistId: user.id },
      // Only paid orders count toward earnings (matches admin payouts)
      order: {
        paymentStatus: "paid",
        kind: { not: "bulk" },
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
      },
    },
    select: {
      id: true,
      title: true,
      size: true,
      frameChosen: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      artistSplit: true,
      printCost: true,
      shippingCost: true,
      laborCost: true,
      websiteCost: true,
      order: { select: { createdAt: true, email: true, currency: true } },
    },
    orderBy: [{ order: { createdAt: "asc" } }],
  });

  // Nothing sold (in that year): say so instead of sending a file with only a header.
  if (items.length === 0) {
    return NextResponse.json(
      {
        error: year ? `No sales in ${year} to export.` : "No sales to export yet. Your first sale shows up on Sales the moment it happens.",
        code: "no_sales",
      },
      { status: 404 },
    );
  }

  // Authoritative per-item math from lib/revenue.ts (60/40 from 2026-10-21, 50/50 before)
  const breakdowns = items.map((it) =>
    itemBreakdown({
      lineTotal: it.lineTotal,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      size: it.size,
      frameChosen: it.frameChosen,
      orderDate: it.order.createdAt,
      artistSplit: it.artistSplit,
    })
  );

  // Per-row in cents → convert to $ for the CSV
  const rows = items.map((it, i) => {
    const b = breakdowns[i];
    const qty = b.quantity;
    const totalCents = b.lineTotal;
    const expensesCents = b.expenses;
    const artistShareCents = b.artistShare;

    return {
      date: it.order?.createdAt ? new Date(it.order.createdAt).toISOString().slice(0, 10) : "",
      artwork: it.title ?? "",
      qty,
      buyer: it.order?.email ?? "",
      total_dollars: toDollars(totalCents),
      expenses_dollars: toDollars(expensesCents),
      artist_share_dollars: toDollars(artistShareCents),
      currency: it.order?.currency ?? "USD",
    };
  });

  // Totals (still aggregate in cents, then convert to $)
  const totals = breakdowns.reduce(
    (acc, b) => {
      acc.orders += 1;
      acc.quantity += b.quantity;
      acc.gross_cents += b.lineTotal;
      acc.expenses_cents += b.expenses;
      acc.artist_share_cents += b.artistShare;
      return acc;
    },
    { orders: 0, quantity: 0, gross_cents: 0, expenses_cents: 0, artist_share_cents: 0 }
  );

  // CSV header (now in dollars)
  const header = [
    "Date",
    "Artwork",
    "Qty",
    "Buyer",
    "Total ($)",
    "Expenses ($)",
    "Your Share ($)",
    "Currency",
  ];

  const bodyLines = rows.map((r) =>
    [
      r.date,
      r.artwork,
      r.qty,
      r.buyer,
      r.total_dollars,
      r.expenses_dollars,
      r.artist_share_dollars,
      r.currency,
    ].map(csvEscape).join(",")
  );

  // Totals section in dollars
  const totalsHeader = [
    `Totals for ${year ?? "all years"}`,
    "",                // artwork
    "Quantity",
    "Orders",
    "Gross ($)",
    "Expenses ($)",
    "Your Share ($)",
    "",                // currency
  ];

  const totalsRow = [
    "", // (label is above)
    "",
    totals.quantity,
    totals.orders,
    toDollars(totals.gross_cents),
    toDollars(totals.expenses_cents),
    toDollars(totals.artist_share_cents),
    "",
  ].map(csvEscape).join(",");

  const csv = [
    header.join(","),
    ...bodyLines,
    "", // blank line before totals
    totalsHeader.join(","),
    totalsRow,
  ].join("\n");

  const filename = `artfinity-sales-${year ?? "all"}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
