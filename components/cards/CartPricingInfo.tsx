import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const CartPricingInfo = ({
  subtotal,
  shipping,
  estimatedTax,
  total,
  currency = "$",
  decimalPrecision = 2,
  children,
  className,
}: {
  subtotal: number;
  shipping: number;
  estimatedTax: number;
  total: number;
  currency?: string;
  decimalPrecision?: number;
  children?: ReactNode;
  className?: string;
}): ReactNode => {
  return (
    <div className={cn("w-full p-4 capitalize", className)}>
      <h3 className="mb-4 font-semibold">Order Summary</h3>
      <div className="mb-2 flex justify-between">
        <span>Subtotal:</span>
        <span className="font-medium">
          {currency}
          {subtotal.toFixed(decimalPrecision)}
        </span>
      </div>
      <div className="mb-2 flex justify-between">
        <span>Shipping:</span>
        <span className="font-medium">
          {shipping !== 0 ? shipping : "free"}
        </span>
      </div>
      <div className="mb-2 flex justify-between">
        <span>Estimated Tax:</span>
        <span className="font-medium">
          {currency}
          {estimatedTax.toFixed(decimalPrecision)}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Total:</span>
        <span className="text-lg font-semibold">
          {currency}
          {total.toFixed(decimalPrecision)}
        </span>
      </div>
      <div className="flex w-full flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default CartPricingInfo;
