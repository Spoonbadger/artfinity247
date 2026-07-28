export const basePrices = {
  small: 3499,
  medium: 4499,
  large: 6499,
  xl: 7999,
  // xxl: 8999,
} as const

export const framePrices = {
  small: 6500,   // +$65.00 → $99.99 total
  medium: 11500, // +$115.00 → $159.99 total
  large: 16500,  // +$165.00 → $229.99 total
  xl: 22000,    //  +$220.00 → $299.99 total
} as const

export const getFinalPrice = (
  size: keyof typeof basePrices,
  markup: number = 0,
  frameChosen: boolean = false
) => {
  let price = basePrices[size] + markup

  if (frameChosen) {
    const framePrice = framePrices[size as keyof typeof framePrices]

    if (framePrice === undefined) {
      throw new Error(`Framing is not configured for size: ${size}`)
    }

    price += framePrice
  }

  return price
}