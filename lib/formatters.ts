// Format Currency
export const formatCurrency = (
  amount?: number | null,
  currency: string = "USD",
  minimumFractionDigits: number = 0,
): string => {
  if (!amount && amount !== 0) {
    return formatCurrency(0, currency);
  }

  return new Intl.NumberFormat("en-US", {
    currency,
    style: "currency",
    minimumFractionDigits,
  }).format(amount);
};

// Format Numbers
export const formatNumber = (number: number | null) => {
  if (!number) {
    return number;
  }
  return new Intl.NumberFormat("en-US").format(number);
};
