// app/api/my-sales/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

export const runtime = "nodejs";

async function getUserFromCookie(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    return payload as { id?: string };
  } catch {
    return null;
  }
}

function csvEscape(v: unknown) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toDollars = (cents: number) => (cents / 100).toFixed(2);

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie(req);
  if (!user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

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
      ...(createdAtFilter ? { order: { createdAt: createdAtFilter } } : {}),
    },
    select: {
      id: true,
      title: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      printCost: true,
      shippingCost: true,
      laborCost: true,
      websiteCost: true,
      order: { select: { createdAt: true, email: true, currency: true } },
    },
    orderBy: [{ order: { createdAt: "asc" } }],
  });

  // Per-row in cents → convert to $ for the CSV
  const rows = items.map((it) => {
    const qty = it.quantity ?? 1;
    const totalCents = it.lineTotal ?? (it.unitPrice ?? 0) * qty;
    const expensesCents =
      (it.printCost ?? 0) +
      (it.shippingCost ?? 0) +
      (it.laborCost ?? 0) +
      (it.websiteCost ?? 0);
    const artistShareCents = Math.max(0, Math.floor((totalCents - expensesCents) / 2));

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
  const totals = items.reduce(
    (acc, it) => {
      const qty = it.quantity ?? 1;
      const total = it.lineTotal ?? (it.unitPrice ?? 0) * qty;
      const expenses =
        (it.printCost ?? 0) +
        (it.shippingCost ?? 0) +
        (it.laborCost ?? 0) +
        (it.websiteCost ?? 0);
      const artistShare = Math.max(0, Math.floor((total - expenses) / 2));
      acc.orders += 1;
      acc.quantity += qty;
      acc.gross_cents += total;
      acc.expenses_cents += expenses;
      acc.artist_share_cents += artistShare;
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
