// app/api/my-sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";


export const runtime = "nodejs";

type JwtPayload = { id?: string; slug?: string; email?: string };
type SaleRow = {
  // …your other fields
  total_cents: number
  expenses_cents: number
  artist_share_cents: number
}

type Totals = {
  items: number
  quantity: number
  gross_cents: number
  expenses_cents: number
  artist_share_cents: number
}

const totalsInit: Totals = {
  items: 0,
  quantity: 0,
  gross_cents: 0,
  expenses_cents: 0,
  artist_share_cents: 0,
}


function monthRangeOrNull(month?: string) {
  // month in "YYYY-MM"
  if (!month) return null;
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const [_, y, mm] = m;
  const start = new Date(Number(y), Number(mm) - 1, 1, 0, 0, 0, 0);
  const end = new Date(Number(y), Number(mm), 1, 0, 0, 0, 0); // first day next month
  return { start, end };
}

export async function GET(req: NextRequest) {
    let user
    try {
      user = await requireUser();
    } catch {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || undefined;
  const range = monthRangeOrNull(month);

  const items = await prisma.orderItem.findMany({
    where: {
      artwork: { artistId: user.id },
      ...(range && { order: { createdAt: { gte: range.start, lt: range.end } } }),
    },
    select: {
      id: true,
      title: true,
      size: true,
      quantity: true,
      unitPrice: true, // cents
      lineTotal: true, // cents
      printCost: true,
      shippingCost: true,
      laborCost: true,
      websiteCost: true,
      order: {
        select: {
          createdAt: true,
          email: true,
          paymentStatus: true,
          currency: true,
        },
      },
    },
    orderBy: [{ order: { createdAt: "desc" } }],
  });

  const rows = items.map((it) => {
    const qty = it.quantity ?? 1;
    const unit = it.unitPrice ?? 0;
    const total = it.lineTotal ?? unit * qty;

    const costs =
      (it.printCost ?? 0) +
      (it.shippingCost ?? 0) +
      (it.laborCost ?? 0) +
      (it.websiteCost ?? 0);

    const expenses = (it.printCost ?? 0) + (it.shippingCost ?? 0) + (it.laborCost ?? 0) + (it.websiteCost ?? 0);
    const profit = Math.max(0, total - costs);
    const artistShare = Math.floor(profit / 2);

    return {
      id: it.id,
      createdAt: it.order?.createdAt ?? null,
      artworkTitle: it.title ?? "-",
      quantity: qty,
      buyerEmail: it.order?.email ?? null,
      total_cents: total,
      expenses_cents: expenses,
      artist_share_cents: artistShare,
      currency: it.order?.currency ?? "usd",
      // keep if you later want to surface it: paymentStatus: it.order?.paymentStatus ?? null,
    }
  })

const totals = rows.reduce(
  (acc, r) => {
    acc.items += 1
    acc.quantity += r.quantity ?? 0
    acc.gross_cents += r.total_cents ?? 0
    acc.expenses_cents += r.expenses_cents ?? 0   // <— add this
    acc.artist_share_cents += r.artist_share_cents ?? 0
    return acc
  },
  { items: 0, quantity: 0, gross_cents: 0, expenses_cents: 0, artist_share_cents: 0 }
)

  return NextResponse.json({ items: rows, totals, month: month ?? "all" });
}
