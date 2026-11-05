import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdmin } from "@/lib/admin"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"
import { isPayoutLate } from "@/lib/balance"
import { connectMode, connectStatus } from "@/lib/stripeConnect"
import { activeRefunds, shareAfterRefund } from "@/lib/refunds"

export const dynamic = "force-dynamic"

function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error("Invalid month format. Use YYYY-MM");
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1));
  return { start, end };
}


function normalizeSize(raw: string | null): PrintSize {
  const v = (raw || "").toUpperCase();
  if (v.startsWith("S")) return "S";
  if (v.startsWith("XL")) return "XL"
  if (v.startsWith("L")) return "L";
  return "M";
}

export async function GET(req: NextRequest) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    if (!month) return NextResponse.json({ error: "month required (YYYY-MM)" }, { status: 400 })

    const { start, end } = monthRange(month);

    // Get all paid orders (or all orders—adjust if you only want captured/paid)
    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        paymentStatus: "paid",
        kind: { not: "bulk" }, // an artist's own at-cost order earns nothing
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            artwork: { select: { artistId: true } },
          },
        },
      },
    });

    // Aggregate per artist
    type RowAgg = {
      artistId: string;
      itemsCount: number;
      gross: number;     // sum(lineTotal)
      expenses: number;  // sum of all costs
      profit: number;    // sum(profit)
      artistShare: number;
      companyShare: number;
    };

    const byArtist = new Map<string, RowAgg>();
    // Refunded lines whose share was reversed pay the artist nothing (lib/refunds.ts).
    const refunds = await activeRefunds(orders.map((o) => o.id));

    for (const order of orders) {
      for (const item of order.items) {
        const artistId = item.artwork?.artistId ?? "__unknown__"
        const qty = item.quantity ?? 0;
        const unit = item.unitPrice ?? 0;
        const lineTotal = item.lineTotal ?? qty * unit;
        const size = normalizeSize(item.size as string | null);

        const b = calcItemProfitCents({
          lineTotal,
          size,
          frameChosen: item.frameChosen,
          quantity: qty || 1,
          orderDate: order.createdAt,
          artistSplit: item.artistSplit,
        })
        const expenses = b.printCost + b.shippingCost + b.laborCost + b.websiteCost;

        const row = byArtist.get(artistId) ?? {
          artistId,
          itemsCount: 0,
          gross: 0,
          expenses: 0,
          profit: 0,
          artistShare: 0,
          companyShare: 0,
        };

        row.itemsCount += qty || 1; // if qty null, count at least 1
        row.gross += lineTotal;
        row.expenses += expenses;
        row.profit += b.profit;
        row.artistShare += shareAfterRefund(b.artistShare, refunds.get(item.id));

        byArtist.set(artistId, row);
      }
    }

    const artistIds = Array.from(byArtist.keys());
    if (artistIds.length === 0) {
      return NextResponse.json({ rows: [] });
    }

    // Fetch artist info in one go
    const artists = await prisma.artist.findMany({
      where: { id: { in: artistIds } },
      select: { id: true, artist_name: true, name: true, email: true, venmoHandle: true, closedAt: true, stripeAccountId: true, stripePayoutsEnabled: true },
    });
    const artistMap = new Map<string, (typeof artists)[number]>(
      artists.map((a: any) => [a.id, a])
    )

    // Fetch payout statuses for the month in one go
    const payouts = await prisma.payout.findMany({
      where: { artistId: { in: artistIds }, month },
      select: { artistId: true, paidAt: true, amountCents: true, method: true, stripeTransferId: true, failureReason: true },
    });
    const payoutMap = new Map<string, (typeof payouts)[number]>(
      payouts.map((p: any) => [p.artistId, p])
    )


    // Late: unpaid more than a few days after this month's payout day (lib/balance.ts).
    const monthLate = isPayoutLate(month)
    const mode = connectMode()

    const rows = artistIds.map(artistId => {
      const agg = byArtist.get(artistId)!;
      const a = artistMap.get(artistId);
      const p = payoutMap.get(artistId);

      return {
        artistId,
        artistName: a?.artist_name || a?.name || "(unknown)",
        artistEmail: a?.email || "",
        venmoHandle: a?.venmoHandle || "",
        // How they get paid: Stripe (connected and ready), setting up Stripe, or Venmo by hand.
        stripe: a ? connectStatus(a, mode) : "not_connected",
        itemsCount: agg.itemsCount,
        gross: agg.gross,
        expenses: agg.expenses,
        profit: agg.profit,
        artistShare: agg.artistShare,
        // Closed accounts are still paid what they earned.
        closed: !!a?.closedAt,
        late: monthLate && !p?.paidAt && agg.artistShare > 0 && artistId !== "__unknown__",
        payout: {
          status: p?.paidAt ? "PAID" : "UNPAID",
          paidAt: p?.paidAt || null,
          amountCents: p?.amountCents ?? agg.artistShare,
          method: p?.method ?? null,
          stripeTransferId: p?.stripeTransferId ?? null,
          failureReason: p?.paidAt ? null : p?.failureReason ?? null,
        },
      };
    });

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("payouts summary error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}