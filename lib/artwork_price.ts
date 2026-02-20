
export const basePrices = {
  small: 2999,
  medium: 3999,
  large: 5499,
  xl: 6999,
  xxl: 7999
}

export const getFinalPrice = (
  size: 'small' | 'medium' | 'large',
  markup: number = 0
) => {
  return basePrices[size] + markup;
}
