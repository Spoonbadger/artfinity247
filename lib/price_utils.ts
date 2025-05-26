import { ProductVariantType } from "@/types";

export const getLowestPrice = (
  productVariants: ProductVariantType[],
  defaultPice?: number | null,
) => {
  let lowestVariantPrice = Infinity;
  defaultPice = defaultPice ?? Infinity;

  for (const variantGroup of productVariants) {
    for (const variant of variantGroup.data) {
      if (variant.price < lowestVariantPrice) {
        lowestVariantPrice = variant.price;
      }
    }
  }

  return lowestVariantPrice < defaultPice ? lowestVariantPrice : defaultPice;
};
