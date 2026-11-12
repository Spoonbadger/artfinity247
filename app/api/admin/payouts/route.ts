import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"
import { activeRefunds, adjustmentTotals, refundAdjustments, shareAfterRefund } from "@/lib/refunds"
import { getBalance } from "@/lib/balance"

export const dynamic = "force-dynamic"
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


function normalizeSize(raw: string | null): PrintSize {
  const v = (raw || "").toUpperCase()
  if (v.startsWith("S")) return "S"
  if (v.startsWith("XL")) return "XL"
  if (v.startsWith("L")) return "L"
  return "M"
}


export async function GET(req: NextRequest) {
  // The month's money report as a file (company share, profit, every artist's payout): admin or owner.
  const { admin, denied } = await adminRoleGuard("money")
  if (denied) return denied

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
        kind: { not: 'bulk' }, // an artist's own at-cost order earns nothing
      },
    },
    select: {
      id: true,
      orderId: true,
      lineTotal: true,
      size: true,
      quantity: true,
      frameChosen: true,
      artistSplit: true,
      artistName: true,
      artwork: { select: { artistId: true } },
      order: { select: { createdAt: true } },
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
  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.orderId))))

  const payouts = await prisma.payout.findMany({
    where: { month },
    select: { artistId: true, paidAt: true, amountCents: true },
  })
  const paidLookup = new Map(payouts.map((p: any) => [p.artistId, p.paidAt]))
  const recordedLookup = new Map(payouts.filter((p) => p.paidAt).map((p) => [p.artistId, p.amountCents]))

  for (const it of items) {
    const artistId = it.artwork?.artistId ?? 'unknown'
    const key = artistId
    const gross = it.lineTotal ?? 0
    const size = normalizeSize(it.size ?? null) // you'll need to SELECT size below
    const b = calcItemProfitCents({
      lineTotal: gross,
      size,
      frameChosen: it.frameChosen,
      quantity: it.quantity || 1,
      orderDate: it.order.createdAt,
      artistSplit: it.artistSplit,
    })
    const expenses = b.printCost + b.shippingCost + b.laborCost + b.websiteCost
    const profit = b.profit
    const artistShare = shareAfterRefund(b.artistShare, refunds.get(it.id))
    const companyShare = b.companyShare

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

    current.itemsCount += it.quantity || 1
    current.gross += gross
    current.expenses += expenses
    current.profit += profit
    current.artistShare += artistShare
    current.companyShare += companyShare

    // keep a non-empty display name if we see one
    if (!current.artistName && it.artistName) current.artistName = it.artistName

    byArtist.set(key, current)
  }

  // Refund adjustments (lib/refunds.ts): booked to the artist's next unpaid month at refund time. payout_cents is what the month pays
  // (recorded amount once paid; else sales + adjustments + anything carried in, never below 0), same as lib/balance.ts.
  const [monthAdj, allAdj] = await Promise.all([adjustmentTotals({ month }), refundAdjustments()])
  for (const artistId of Array.from(monthAdj.keys())) {
    if (!byArtist.has(artistId)) byArtist.set(artistId, { artistId, artistName: '', itemsCount: 0, gross: 0, expenses: 0, profit: 0, artistShare: 0, companyShare: 0 })
  }
  const withAdj = new Set(allAdj.map((a) => a.artistId))
  const carried = new Map<string, { carryIn: number; payable: number }>()
  for (const artistId of Array.from(byArtist.keys()).filter((id) => withAdj.has(id))) {
    const row = (await getBalance(artistId)).payouts.find((p) => p.month === month)
    if (row) carried.set(artistId, { carryIn: row.carryInCents, payable: row.payableCents })
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
    'refund_adjustment_cents',
    'carried_in_cents',
    'payout_cents',
    'payout_usd',
  ]

  const rows = [header.join(',')]
  for (const row of Array.from(byArtist.values())) {
    const dollars = (c: number) => (c / 100).toFixed(2)
    const status = paidLookup.get(row.artistId) ? 'PAID' : 'UNPAID'
    const adj = monthAdj.get(row.artistId) ?? 0
    const c = carried.get(row.artistId)
    const payout = recordedLookup.get(row.artistId) ?? c?.payable ?? Math.max(0, row.artistShare + adj)
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
        adj,
        status === 'PAID' ? 0 : c?.carryIn ?? 0,
        payout,
        dollars(payout),
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
