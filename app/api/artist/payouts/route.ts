import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { jwtVerify } from 'jose'

export const runtime = 'nodejs'

function monthRange(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error('Invalid month format. Use YYYY-MM')
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1))
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    // Auth: read JWT from cookie
    const token = req.cookies.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const artistId = payload.id as string // store artist id in JWT "sub"
    if (!artistId) return NextResponse.json({ error: 'No artist ID' }, { status: 400 })

    // Parse month
    const { searchParams } = new URL(req.url)
    const month = searchParams.get('month')
    if (!month) return NextResponse.json({ error: 'Missing ?month=YYYY-MM' }, { status: 400 })

    const { start, end } = monthRange(month)

    // Fetch this artist’s sold items for that month
    const items = await prisma.orderItem.findMany({
      where: {
        artwork: { artistId },
        order: {
          createdAt: { gte: start, lt: end },
          paymentStatus: 'paid',
        },
      },
      select: {
        slug: true,
        size: true,
        quantity: true,
        lineTotal: true,
        printCost: true,
        shippingCost: true,
        laborCost: true,
        websiteCost: true,
      },
    })

    // Calculate totals
    let gross = 0, expenses = 0, profit = 0, artistShare = 0
    for (const it of items) {
      const g = it.lineTotal ?? 0
      const e = (it.printCost ?? 0) + (it.shippingCost ?? 0) + (it.laborCost ?? 0) + (it.websiteCost ?? 0)
      const p = g - e
      const a = Math.floor(p / 2)

      gross += g
      expenses += e
      profit += p
      artistShare += a
    }

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
