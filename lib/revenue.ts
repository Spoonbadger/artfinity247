// /lib/revenue.ts
// All currency is in CENTS. Never use floats for money.
import type { Prisma, PrismaClient } from "@prisma/client"
import { PRO, isProActive, type PlanId } from "@/lib/plans"

export type PrintSize = "S" | "M" | "L" | "XL"

/** The Free plan's split for an order date. Orders that stored OrderItem.artistSplit use that instead. */
export function getArtistSplit(orderDate: Date): number {
  const changeDate = new Date("2026-10-21T00:00:00-04:00")

  return orderDate >= changeDate ? 0.6 : 0.5
}

/**
 * Plan-aware split at order time. Pro (proUntil after the order date) gets PRO.split from lib/plans.ts,
 * unless PRO.monthlyPrintCap is set and the artist already sold that many Pro-split prints this month.
 */
export function getArtistSplitFor(args: {
  orderDate: Date
  plan?: PlanId | string | null
  proUntil?: Date | string | null
  /** Prints already paid at the Pro split this calendar month (only matters when a cap is set). */
  proPrintsThisMonth?: number
}): number {
  const base = getArtistSplit(args.orderDate)
  if (!isProActive({ proUntil: args.proUntil }, args.orderDate)) return base
  if (PRO.monthlyPrintCap != null && (args.proPrintsThisMonth ?? 0) >= PRO.monthlyPrintCap) return base
  return Math.max(base, PRO.split)
}

type SplitDb = Pick<PrismaClient, "artist" | "orderItem"> | Prisma.TransactionClient

/**
 * The split to store on each new OrderItem (OrderItem.artistSplit), in line order.
 * Lines whose artist is unknown get the Free split for the date.
 */
export async function artistSplitsForOrder(db: SplitDb, lines: { artistId: string | null | undefined; quantity: number }[], orderDate: Date): Promise<number[]> {
  const ids = Array.from(new Set(lines.map((l) => l.artistId).filter((x): x is string => !!x)))
  const artists = ids.length
    ? await db.artist.findMany({ where: { id: { in: ids } }, select: { id: true, plan: true, proUntil: true } })
    : []
  const byId = new Map(artists.map((a) => [a.id, a]))

  // With a monthly cap, count this month's prints already paid at the Pro split.
  const used = new Map<string, number>()
  if (PRO.monthlyPrintCap != null) {
    const monthStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), 1)
    for (const a of artists) {
      if (!isProActive(a, orderDate)) continue
      const agg = await db.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          artwork: { artistId: a.id },
          artistSplit: { gte: PRO.split },
          order: { paymentStatus: "paid", createdAt: { gte: monthStart } },
        },
      })
      used.set(a.id, agg._sum.quantity ?? 0)
    }
  }

  return lines.map((l) => {
    const a = l.artistId ? byId.get(l.artistId) : undefined
    if (!a) return getArtistSplit(orderDate)
    const split = getArtistSplitFor({ orderDate, plan: a.plan, proUntil: a.proUntil, proPrintsThisMonth: used.get(a.id) ?? 0 })
    if (split >= PRO.split && PRO.monthlyPrintCap != null) used.set(a.id, (used.get(a.id) ?? 0) + l.quantity)
    return split
  })
}

// export const FRAME_ARTIST_BONUS = 500


export const COSTS = {
  ITEM: {
    UNFRAMED: {
      S: 1799,
      M: 2299,
      L: 2799,
      XL: 3699
    },
    FRAMED: {
      S: 5399,
      M: 9699,
      L: 13999,
      XL: 17199
    },
  },

  LABOR_PER_ITEM: 0,
  HOSTING_PER_ITEM: 100,
  STRIPE_PERCENT: 0.029,
  STRIPE_FIXED: 30,
}

/** Stripe-like fee in cents, from a gross charge amount (in cents). */
export function paymentFeeCents(amountCents: number): number {
  const percent = Math.ceil(amountCents * COSTS.STRIPE_PERCENT);
  return percent + COSTS.STRIPE_FIXED;
}

/** Website/overhead cost in cents. */
export function websiteCostCents(amountCents: number): number {
  return paymentFeeCents(amountCents) + (COSTS.HOSTING_PER_ITEM || 0);
}


export function calcItemProfitCents(args: {
  lineTotal: number
  size: PrintSize
  frameChosen?: boolean
  quantity?: number
  orderDate: Date
  /** OrderItem.artistSplit, locked in when the order was placed. Falls back to getArtistSplit(orderDate). */
  artistSplit?: number | null
}) {
  const {
    lineTotal,
    size,
    frameChosen = false,
    quantity = 1,
    orderDate,
    artistSplit,
  } = args

  const unitItemCost = frameChosen
    ? COSTS.ITEM.FRAMED[size]
    : COSTS.ITEM.UNFRAMED[size]

  const itemCost = unitItemCost * quantity
  const laborCost = COSTS.LABOR_PER_ITEM * quantity

  const websiteCost =
    paymentFeeCents(lineTotal) +
    COSTS.HOSTING_PER_ITEM * quantity

  const expenses =
    itemCost +
    laborCost +
    websiteCost

  const profit = Math.max(0, lineTotal - expenses)

  const split = typeof artistSplit === "number" && artistSplit > 0 && artistSplit < 1 ? artistSplit : getArtistSplit(orderDate)
  const artistShare = Math.round(profit * split)
  const companyShare = profit - artistShare


  return {
    itemCost,

    // Temporary compatibility with your database/admin page
    printCost: itemCost,
    shippingCost: 0,
    laborCost,
    websiteCost,
    frameCost: 0,

    expenses,
    profit,
    artistShare,
    companyShare,
    split,
  }
}