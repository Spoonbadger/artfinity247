import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from 'next/server'


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const email = searchParams.get('email')
  const status = searchParams.get('status')
  const before = searchParams.get('before')
  const after = searchParams.get('after')

  const filters: any = {}

  if (email) filters.email = email
  if (status) filters.paymentStatus = status
  if (after || before) {
    filters.createdAt = {}
    if (after) filters.createdAt.gte = new Date(after)
    if (before) filters.createdAt.lte = new Date(before)
  }

const orders = await prisma.order.findMany({
  where: filters,
  orderBy: { createdAt: 'desc' },
  include: {
    items: {
      select: {
        id: true,
        slug: true,
        size: true,
        quantity: true,
        unitPrice: true,
        lineTotal: true,
        printCost: true,
        shippingCost: true,
        laborCost: true,
        websiteCost: true,
        artwork: {
          select: {
            artistId: true,
          },
        },
      },
    },
  },
})

const month = new Date().toISOString().slice(0, 7)
const payouts = await prisma.payout.findMany({
  where: { month },
  select: { artistId: true, paidAt: true },
})
const paidLookup = new Map(payouts.map(p => [p.artistId, p.paidAt]))

  // add profit + shares per item
  const withShares = orders.map(order => ({
    ...order,
    items: order.items.map(item => {
      const expenses =
        (item.printCost ?? 0) +
        (item.shippingCost ?? 0) +
        (item.laborCost ?? 0) +
        (item.websiteCost ?? 0)

      const profit = (item.lineTotal ?? 0) - expenses
      const artistShare = Math.floor(profit / 2)
      const companyShare = profit - artistShare

      return {
        ...item,
        profit,
        artistShare,
        companyShare,
        payoutStatus: item.artwork && paidLookup.get(item.artwork.artistId)
          ? 'PAID'
          : 'UNPAID',
      }
    }),
  })) 


  return NextResponse.json(withShares)
}
