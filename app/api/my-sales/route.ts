// app/api/my-sales/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { itemBreakdown } from "@/lib/sales";


export const dynamic = "force-dynamic"
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
  // UTC, same as the admin payout pages
  const start = new Date(Date.UTC(Number(y), Number(mm) - 1, 1));
  const end = new Date(Date.UTC(Number(y), Number(mm), 1)); // first day next month
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
      // Only paid orders count toward earnings (matches admin payouts)
      order: {
        paymentStatus: "paid",
        kind: { not: "bulk" },
        ...(range && { createdAt: { gte: range.start, lt: range.end } }),
      },
    },
    select: {
      id: true,
      title: true,
      size: true,
      quantity: true,
      unitPrice: true, // cents
      lineTotal: true, // cents
      frameChosen: true,
      artistSplit: true,
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

  const rows = items.map((it: any) => {
    // Authoritative math from lib/revenue.ts (60/40 from 2026-10-21, 50/50 before),
    // identical to what admin payouts pay out.
    const b = itemBreakdown({
      lineTotal: it.lineTotal,
      unitPrice: it.unitPrice,
      quantity: it.quantity,
      size: it.size,
      frameChosen: it.frameChosen,
      orderDate: it.order.createdAt,
      artistSplit: it.artistSplit,
    });
    const qty = b.quantity;
    const total = b.lineTotal;
    const expenses = b.expenses;
    const artistShare = b.artistShare;

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
  (acc: any, r: any) => {
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
