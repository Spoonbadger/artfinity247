// /lib/revenue.ts
// All currency is in CENTS. Never use floats for money.

export type PrintSize = "S" | "M" | "L" | "XL"

export const ARTIST_SPLIT = 0.5 as const

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
}) {
  const {
    lineTotal,
    size,
    frameChosen = false,
    quantity = 1,
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

  const artistShare = Math.round(profit * ARTIST_SPLIT)
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
  }
}