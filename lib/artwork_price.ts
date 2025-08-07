
export const basePrices = {
  small: 2499,
  medium: 3999,
  large: 5999,
};

export const getFinalPrice = (
  size: 'small' | 'medium' | 'large',
  markup: number = 0
) => {
  return basePrices[size] + markup;
}
