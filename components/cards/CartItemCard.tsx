import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/contexts";
import ProductQuantityInput from "@/components/ProductQuantityInput";
import { CartItemType } from "@/types";
import { getAppPages, getProduct, getProducts, getSeller } from "@/db/query";
import { cn } from "@/lib/utils";
import { getFinalPrice } from "@/lib/artwork_price";


const AppPages = getAppPages();

const CartItemCard = ({
  item,
  className,
}: {
  item: CartItemType;
  className?: string;
}): ReactNode => {
  const { updateToCart, removeFromCart } = useCart();

  const [quantity, setQuantity] = useState<number>(item.quantity);

  const product = getProduct({ id: item.product._id });
  const seller = getSeller({ id: product?.seller || null });


  const sizeKey = (item.product?.variants?.find(v => v.type === 'print_size')?.key?.toLowerCase() ?? 'medium') as 'small' | 'medium' | 'large';
  const markupMap = {
    small: product?.markupSmall,
    medium: product?.markupMedium,
    large: product?.markupLarge,
  }
  const markup = markupMap[sizeKey] ?? 0;  const unitPrice = getFinalPrice(sizeKey, markup)


  // Input area configs
  const minQuantity = 1;
  const maxQuantity = product?.available ?? minQuantity;
  const quantityChangeStep = 1;

  useEffect(() => {
    updateToCart(item.product, quantity);
  }, [quantity, item.product, updateToCart]);

  return (
    <div
      className={cn(
        "grid grid-cols-[0.5fr_1fr] items-center gap-x-2 gap-y-6 p-2 text-start sm:grid-cols-[8rem_1fr] md:grid-cols-[0.25fr_1fr_0.25fr] md:justify-between md:p-4",
        className,
      )}
    >
      <div className="product-image">
        <Image
          width={100}
          height={100}
          src={product?.imageUrl || ""}
          alt={product?.title || ""}
          className="aspect-square w-full min-w-12 max-w-16 rounded-sm object-cover"
        />
      </div>
      <div className="md:px-5">
        <p className="product-seller line-clamp-3 text-xs uppercase">
          {seller?.seller_name}
        </p>
        <h4 className="product-title line-clamp-3 font-bold">
          <Link href={`/${AppPages.products.slug}/${product?.slug}`}>
            {product?.title || ""}
          </Link>
        </h4>
        <div
          className={cn("additional-info", "[&>*]:text-xs [&>*]:md:text-sm")}
        >
          {item.product?.variants?.map((variant, index) => {
            const product = getProducts().find(
              (p) => p.id === item.product?._id,
            );
            const variantTitle = product?.variants?.find(
              (v) => v.type === variant.type,
            )?.title;

            return (
              <p key={index} className="mx-auto capitalize md:mx-0">
                {variantTitle || variant.type.replace("_", " ")}: {variant.key}
              </p>
            );
          })}
            <p className="text-sm font-semibold">
              Price: ${(unitPrice / 100).toFixed(2)}
            </p>
        </div>
      </div>
      <ProductQuantityInput
        quantity={quantity}
        minQuantity={minQuantity}
        maxQuantity={maxQuantity}
        step={quantityChangeStep}
        setQuantity={setQuantity}
        handleRemove={() => {
          product &&
            removeFromCart(item.product)
        }}
        showRemoveBtn={true}
        className="col-span-2 flex justify-center space-x-2 md:col-span-1 md:justify-self-end"
      />
    </div>
  );
};

export default CartItemCard
