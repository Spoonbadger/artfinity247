import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { itemBreakdown } from "@/lib/sales";

export const runtime = 'nodejs'
export const dynamic = "force-dynamic"

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error('Invalid month format. Use YYYY-MM')
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1))
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromCookie()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const artistId = user.id
    if (!artistId) return NextResponse.json({ error: 'No artist ID' }, { status: 400 })

    // Parse month
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'Missing ?month=YYYY-MM' }, { status: 400 })

    let range: { start: Date; end: Date }
    try {
      range = monthRange(month)
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Invalid month' }, { status: 400 })
    }
    const { start, end } = range

    // Fetch this artist’s sold items for that month
    const rows = await prisma.orderItem.findMany({
      where: {
        artwork: { artistId },
        order: {
          createdAt: { gte: start, lt: end },
          paymentStatus: 'paid',
          kind: { not: 'bulk' },
        },
      },
      select: {
        slug: true,
        size: true,
        quantity: true,
        unitPrice: true,
        lineTotal: true,
        frameChosen: true,
        printCost: true,
        shippingCost: true,
        laborCost: true,
        websiteCost: true,
        order: { select: { createdAt: true } },
      },
    })

    // Same math as the admin payout pages (lib/revenue.ts: 60/40 from 2026-10-21, 50/50 before).
    let gross = 0, expenses = 0, profit = 0, artistShare = 0
    const items = rows.map(({ order, unitPrice, frameChosen, ...it }) => {
      const b = itemBreakdown({
        lineTotal: it.lineTotal,
        unitPrice,
        quantity: it.quantity,
        size: it.size,
        frameChosen,
        orderDate: order.createdAt,
      })
      gross += b.lineTotal
      expenses += b.expenses
      profit += b.profit
      artistShare += b.artistShare
      return { ...it, artistShare: b.artistShare }
    })

    return NextResponse.json({
      month,
      gross,
      expenses,
      profit,
      artistShare,
      currency: 'USD',
      items,
    })
  } catch (err: any) {
    console.error('Artist payouts error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
