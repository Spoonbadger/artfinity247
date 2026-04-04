// /lib/revenue.ts
// All currency is in CENTS. Never use floats for money.

export type PrintSize = "S" | "M" | "L";

export const ARTIST_SPLIT = 0.5 as const

export const FRAME_COST = 2500
export const FRAME_ARTIST_BONUS = 500

/**
 * TODO: Replace the placeholder cost values below with the values
 * you agreed earlier. Keep everything in cents.
 */

  // WITH GELATO NOT GOOD PRINTS
// export const COSTS = {
//   PRINT: {
//     S: 1520,   // $15.20
//     M: 1803,   // $18.03
//     L: 2065,   // $20.65
//     // XL: 1111 
//     // XXL: 11111
//   } as Record<PrintSize, number>,

  // TODO TODO TODO: NOW TESTING WITH PRODIGI - prices keep changing??? confused
  // S: M: 25.63 L: XL: XXL: 
  export const COSTS = {
  PRINT: {
    S: 1520,   // $15.20??
    M: 2063,   // $25.63??? needs looking at properly
    L: 2355,   // $20.65??
    // XL: 1111 
    // XXL: 11111
  } as Record<PrintSize, number>,

  SHIPPING: {
    S: 0,   //  $0.00
    M: 0,   // $0.00
    L: 0,   // $0.00
  } as Record<PrintSize, number>,

  LABOR_PER_ITEM: 0,      // $1.00 (packing, handling/placing online order) PUTTING ZERO FOR NOW WHY NOT.
  HOSTING_PER_ITEM: 100, // $1.00 Web hosting

  // Stripe payment fee. 
  STRIPE_PERCENT: 0.029,  // 2.9%
  STRIPE_FIXED: 30,       // 30 cents
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

/** Deterministic cost breakdown by size (in cents). */
export function costBreakdownBySize(size: PrintSize) {
  return {
    printCost: COSTS.PRINT[size] ?? 0,
    shippingCost: COSTS.SHIPPING[size] ?? 0,
    laborCost: COSTS.LABOR_PER_ITEM ?? 0,
  };
}

/**
 * Core profit calc for a line item.
 * Pass lineTotal (cents), and either:
 *  - size (we derive print/shipping/labor from COSTS), OR
 *  - explicit costs (print/shipping/labor)
 * Website cost is always derived from lineTotal.
 */
export function calcItemProfitCents(args: {
  lineTotal: number;
  size?: PrintSize;
  frameChosen?: boolean;
  printCost?: number;
  shippingCost?: number;
  laborCost?: number;
}) {
  const {
    lineTotal,
    size,
    frameChosen = false,
    printCost: pOverride,
    shippingCost: sOverride,
    laborCost: lOverride,
  } = args;

  const bySize = size ? costBreakdownBySize(size) : { printCost: 0, shippingCost: 0, laborCost: 0 };

  const printCost   = pOverride ?? bySize.printCost;
  const shippingCost= sOverride ?? bySize.shippingCost;
  const laborCost   = lOverride ?? bySize.laborCost;

  const webCost = websiteCostCents(lineTotal);
  const frameCost = frameChosen ? FRAME_COST : 0

  const expenses = (printCost || 0) + (shippingCost || 0) + (laborCost || 0) + webCost + frameCost
  const profit = Math.max(0, (lineTotal || 0) - expenses);

  let artistShare = Math.round(profit * ARTIST_SPLIT);
  let companyShare = profit - artistShare;
  if (frameChosen) {
    const safeBonus = Math.min(FRAME_ARTIST_BONUS, companyShare);
    artistShare += safeBonus;
    companyShare -= safeBonus;
  }

  return {
    // costs
    printCost,
    shippingCost,
    laborCost,
    websiteCost: webCost,
    frameCost,

    // totals
    expenses,
    profit,
    artistShare,
    companyShare,
  };
}
