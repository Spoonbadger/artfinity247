export const basePrices = {
  small: 3499,
  medium: 4499,
  large: 5999,
  xl: 6999,
  xxl: 7999,
} as const

const FRAME_COST = 2500 // $25.00

export const getFinalPrice = (
  size: keyof typeof basePrices,
  markup: number = 0,
  frameChosen: boolean = false
) => {
  const basePrice = basePrices[size] ?? 0
  let price = basePrice + markup

  if (frameChosen) {
    price += FRAME_COST
  }

  return price
}