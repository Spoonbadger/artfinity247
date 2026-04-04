export const basePrices = {
  small: 3500,
  medium: 4500,
  large: 6000,
  xl: 7000,
  xxl: 8000,
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