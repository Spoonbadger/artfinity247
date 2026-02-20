
export const basePrices = {
  small: 3499,
  medium: 4499,
  large: 5499,
  xl: 6499,
  xxl: 7999
}

export const getFinalPrice = (
  size: 'small' | 'medium' | 'large' | 'xl' | 'xxl',
  markup: number = 0
) => {
  return basePrices[size] + markup
}
