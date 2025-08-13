import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/components/contexts";
import ProductQuantityInput from "@/components/ProductQuantityInput";
import { CartItemType } from "@/types";
import { getAppPages } from "@/db/query";
import { cn } from "@/lib/utils";

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

  const unitPrice = item.product.unitPrice;
  const minQuantity = 1;
  const MAX_QTY_CAP = 100
  const maxQuantity = MAX_QTY_CAP
  const quantityChangeStep = 1;


  // Handle user-driven quantity change only
  const handleQuantityChange = (q: number) => {
    setQuantity(q);
    updateToCart(item.product, q);
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[0.5fr_1fr] items-center gap-x-2 gap-y-6 p-2 text-start sm:grid-cols-[8rem_1fr] md:grid-cols-[0.25fr_1fr_0.25fr] md:justify-between md:p-4",
        className,
      )}
    >
      {/* Product Image */}
      <div className="product-image">
        <Image
          width={100}
          height={100}
          src={item.product?.imageUrl || ""}
          alt={item.product?.title || ""}
          className="aspect-square w-full min-w-12 max-w-16 rounded-sm object-cover"
        />
      </div>

      {/* Product Info */}
      <div className="md:px-5">
        {item.product?.artist && (
          <p className="product-seller line-clamp-3 text-xs uppercase">
            {item.product.artist}
          </p>
        )}
        <h4 className="product-title line-clamp-3 font-bold">
          <Link href={`/${AppPages.products.slug}/${item.product?.slug}`}>
            {item.product?.title || ""}
          </Link>
        </h4>
        <div className={cn("additional-info", "[&>*]:text-xs [&>*]:md:text-sm")}>
          <p className="text-xs font-thin">Size: {item.product.selectedSize}</p>
          <p className="text-sm font-semibold">
            Price: ${(unitPrice / 100).toFixed(2)}
          </p>
        </div>
      </div>
      
      {/* Quantity + Remove */}
      <ProductQuantityInput
        quantity={quantity}
        minQuantity={minQuantity}
        maxQuantity={maxQuantity}
        step={quantityChangeStep}
        setQuantity={handleQuantityChange}
        handleRemove={() => removeFromCart(item.product)}
        showRemoveBtn={true}
        className="col-span-2 flex justify-center space-x-2 md:col-span-1 md:justify-self-end"
      />
    </div>
  )
}

export default CartItemCard