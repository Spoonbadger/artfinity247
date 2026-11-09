import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"
import { getBalance, isPayoutLate, type PayoutRow } from "@/lib/balance"
import { connectMode, connectStatus } from "@/lib/stripeConnect"
import { activeRefunds, adjustmentTotals, refundAdjustments, shareAfterRefund } from "@/lib/refunds"

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
  // Read-only: the payouts table support sees (its buttons are money-only). Paying and marking paid check "money".
  const { admin, denied } = await adminRoleGuard("view")
  if (denied) return denied

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

    // Refund adjustments (lib/refunds.ts) are booked to the artist's next unpaid month, and a month can't pay below $0
    // (lib/balance.ts carries the rest forward). Artists with any adjustment get their month from getBalance, so this
    // page, Pay all and their Money page agree.
    const [monthAdj, allAdj] = await Promise.all([adjustmentTotals({ month }), refundAdjustments()]);
    for (const artistId of Array.from(monthAdj.keys())) {
      if (!byArtist.has(artistId)) byArtist.set(artistId, { artistId, itemsCount: 0, gross: 0, expenses: 0, profit: 0, artistShare: 0, companyShare: 0 });
    }
    const withAdj = new Set(allAdj.map((a) => a.artistId));
    const balanceRows = new Map<string, PayoutRow>();
    for (const artistId of Array.from(byArtist.keys()).filter((id) => withAdj.has(id))) {
      const row = (await getBalance(artistId)).payouts.find((p) => p.month === month);
      if (row) balanceRows.set(artistId, row);
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
      const refundAdjustmentsCents = monthAdj.get(artistId) ?? 0;
      const br = balanceRows.get(artistId);
      // Owed for the month: sales + refund adjustments (+ any carried in), never below $0 while unpaid.
      const due = br && !p?.paidAt ? br.payableCents : agg.artistShare + refundAdjustmentsCents;

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
        artistShare: due,
        salesShare: agg.artistShare,
        refundAdjustments: refundAdjustmentsCents,
        carriedIn: br && !p?.paidAt ? br.carryInCents : 0,
        // Closed accounts are still paid what they earned.
        closed: !!a?.closedAt,
        late: monthLate && !p?.paidAt && due > 0 && artistId !== "__unknown__",
        payout: {
          status: p?.paidAt ? "PAID" : "UNPAID",
          paidAt: p?.paidAt || null,
          amountCents: p?.amountCents ?? due,
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