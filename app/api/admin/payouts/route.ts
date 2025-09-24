import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify } from 'jose'

const prisma = new PrismaClient()
export const runtime = 'nodejs'

// Helper: parse ?month=YYYY-MM -> [start,end)
function monthRange(ym: string) {
  // expect "2025-09"
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error('Invalid month format. Use YYYY-MM')
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
  const end =
    m === 12
      ? new Date(Date.UTC(y + 1, 0, 1, 0, 0, 0))
      : new Date(Date.UTC(y, m, 1, 0, 0, 0))
  return { start, end }
}

function csvEscape(val: string | number | null | undefined) {
  const s = val == null ? '' : String(val)
  // escape quotes and wrap in quotes if needed
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function requireAdmin(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
  return payload.role === "ADMIN" ? payload : null;  // 🔹 simple
}


export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // YYYY-MM
  if (!month) {
    return NextResponse.json({ error: 'Missing ?month=YYYY-MM' }, { status: 400 })
  }

  let start: Date, end: Date
  try {
    const r = monthRange(month)
    start = r.start
    end = r.end
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Invalid month' }, { status: 400 })
  }

  // Pull all paid items within the month, via their parent order timestamp.
  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: { gte: start, lt: end },
        paymentStatus: 'paid',
      },
    },
    select: {
      // cents
      lineTotal: true,
      printCost: true,
      shippingCost: true,
      laborCost: true,
      websiteCost: true,
      // for grouping
      artistName: true, // snapshot saved at checkout
      artwork: { select: { artistId: true } }, // robust grouping key
    },
  })

  // Aggregate by artistId (fallback to 'unknown') and carry a display name
  type Tot = {
    artistId: string
    artistName: string
    itemsCount: number
    gross: number
    expenses: number
    profit: number
    artistShare: number
    companyShare: number
  }
  const byArtist = new Map<string, Tot>()

  const payouts = await prisma.payout.findMany({
    where: { month },
    select: { artistId: true, paidAt: true },
  })
  const paidLookup = new Map(payouts.map(p => [p.artistId, p.paidAt]))

  for (const it of items) {
    const artistId = it.artwork?.artistId ?? 'unknown'
    const key = artistId
    const gross = it.lineTotal ?? 0
    const expenses =
      (it.printCost ?? 0) +
      (it.shippingCost ?? 0) +
      (it.laborCost ?? 0) +
      (it.websiteCost ?? 0)
    const profit = gross - expenses
    const artistShare = Math.floor(profit / 2)
    const companyShare = profit - artistShare

    const current = byArtist.get(key) ?? {
      artistId,
      artistName: it.artistName ?? '',
      itemsCount: 0,
      gross: 0,
      expenses: 0,
      profit: 0,
      artistShare: 0,
      companyShare: 0,
    }

    current.itemsCount += 1
    current.gross += gross
    current.expenses += expenses
    current.profit += profit
    current.artistShare += artistShare
    current.companyShare += companyShare

    // keep a non-empty display name if we see one
    if (!current.artistName && it.artistName) current.artistName = it.artistName

    byArtist.set(key, current)
  }

  // Build CSV (keep cents for accuracy + provide dollars view)
  const header = [
    'month',
    'artist_id',
    'artist_name',
    'items_count',
    'gross_cents',
    'expenses_cents',
    'profit_cents',
    'artist_share_cents',
    'company_share_cents',
    'gross_usd',
    'expenses_usd',
    'profit_usd',
    'artist_share_usd',
    'company_share_usd',
    'status',
  ]

  const rows = [header.join(',')]
  for (const row of Array.from(byArtist.values())) {
    const dollars = (c: number) => (c / 100).toFixed(2)
    const status = paidLookup.get(row.artistId) ? 'PAID' : 'UNPAID'
    rows.push(
      [
        month,
        csvEscape(row.artistId),
        csvEscape(row.artistName),
        row.itemsCount,
        row.gross,
        row.expenses,
        row.profit,
        row.artistShare,
        row.companyShare,
        dollars(row.gross),
        dollars(row.expenses),
        dollars(row.profit),
        dollars(row.artistShare),
        dollars(row.companyShare),
        status, // 👈
      ].join(',')
    )
  }
  const csv = rows.join('\n')

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="payouts-${month}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
