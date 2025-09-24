import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
export const runtime = "nodejs"

// month="YYYY-MM" -> [start, end)
function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number)
  if (!y || !m || m < 1 || m > 12) throw new Error("Invalid month format. Use YYYY-MM")
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = m === 12 ? new Date(Date.UTC(y + 1, 0, 1)) : new Date(Date.UTC(y, m, 1))
  return { start, end }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const month = searchParams.get("month")
    if (!month) return NextResponse.json({ error: "Missing ?month=YYYY-MM" }, { status: 400 })

    const { start, end } = monthRange(month)

    // Pull all PAID items in the month
    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lt: end },
          paymentStatus: "paid",
        },
      },
      select: {
        lineTotal: true,
        printCost: true,
        shippingCost: true,
        laborCost: true,
        websiteCost: true,
        artwork: { select: { artistId: true } },
        artistName: true, // snapshot
      },
    })

    // Aggregate by artistId
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

    for (const it of items) {
      const artistId = it.artwork?.artistId ?? "unknown"
      const gross = it.lineTotal ?? 0
      const expenses =
        (it.printCost ?? 0) +
        (it.shippingCost ?? 0) +
        (it.laborCost ?? 0) +
        (it.websiteCost ?? 0)
      const profit = gross - expenses
      const artistShare = Math.floor(profit / 2)
      const companyShare = profit - artistShare

      const curr = byArtist.get(artistId) ?? {
        artistId,
        artistName: it.artistName ?? "",
        itemsCount: 0,
        gross: 0,
        expenses: 0,
        profit: 0,
        artistShare: 0,
        companyShare: 0,
      }

      curr.itemsCount += 1
      curr.gross += gross
      curr.expenses += expenses
      curr.profit += profit
      curr.artistShare += artistShare
      curr.companyShare += companyShare
      if (!curr.artistName && it.artistName) curr.artistName = it.artistName

      byArtist.set(artistId, curr)
    }

    // Get artist details for display (name/email/venmoHandle)
    const artistIds = Array.from(byArtist.keys()).filter(id => id !== "unknown")
    const artists = artistIds.length
      ? await prisma.artist.findMany({
          where: { id: { in: artistIds } },
          select: { id: true, name: true, email: true, venmoHandle: true, slug: true },
        })
      : []

    const artistLookup = new Map(artists.map(a => [a.id, a]))

    // Get payout status for this month
    const payouts = await prisma.payout.findMany({
      where: { month },
      select: { artistId: true, paidAt: true, amountCents: true },
    })
    const payoutLookup = new Map(payouts.map(p => [p.artistId, p]))

    // Build response rows
    const rows = Array.from(byArtist.values()).map(row => {
      const a = artistLookup.get(row.artistId)
      const p = payoutLookup.get(row.artistId)
      return {
        month,
        artistId: row.artistId,
        artistName: a?.name || row.artistName || "",
        artistEmail: a?.email || "",
        venmoHandle: a?.venmoHandle || "",
        itemsCount: row.itemsCount,
        gross: row.gross,
        expenses: row.expenses,
        profit: row.profit,
        artistShare: row.artistShare,
        companyShare: row.companyShare,
        payout: {
          status: p?.paidAt ? "PAID" : "UNPAID",
          paidAt: p?.paidAt || null,
          amountCents: p?.amountCents ?? row.artistShare, // fallback
        },
        artistSlug: a?.slug || null,
      }
    })

    // Sort nicely by artist name
    rows.sort((a, b) => a.artistName.localeCompare(b.artistName))

    return NextResponse.json({ month, rows })
  } catch (err: any) {
    console.error("admin payouts summary error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
