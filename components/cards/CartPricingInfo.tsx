import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Order totals. Amounts are in dollars (kept for compatibility); `savings` is optional. */
const CartPricingInfo = ({
  subtotal,
  shipping,
  total,
  savings = 0,
  currency = "$",
  decimalPrecision = 2,
  title = "Summary",
  children,
  className,
}: {
  subtotal: number;
  shipping: number;
  total: number;
  savings?: number;
  currency?: string;
  decimalPrecision?: number;
  title?: string;
  children?: ReactNode;
  className?: string;
}): ReactNode => {
  const f = (n: number) => `${currency}${n.toFixed(decimalPrecision)}`;
  return (
    <div className={cn("box w-full p-5", className)}>
      <h2 className="t-card mb-3">{title}</h2>
      <dl className="num grid gap-1.5 text-[15px]">
        <div className="flex justify-between"><dt className="text-ink-2">Prints</dt><dd>{f(subtotal + savings)}</dd></div>
        {savings > 0 && (
          <div className="flex justify-between"><dt className="text-ink-2">Scan discount</dt><dd>−{f(savings)}</dd></div>
        )}
        <div className="flex justify-between"><dt className="text-ink-2">Shipping</dt><dd>{shipping ? f(shipping) : "Free"}</dd></div>
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
          <dt className="font-bold">Total</dt>
          <dd className="t-section num">{f(total)}</dd>
        </div>
      </dl>
      {children && <div className="mt-4 grid gap-2">{children}</div>}
    </div>
  );
};

export default CartPricingInfo;
