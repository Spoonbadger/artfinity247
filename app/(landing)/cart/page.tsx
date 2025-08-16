"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCart } from "@/components/contexts";
import { useUser } from "@/components/contexts/UserProvider";
import { MaxWidthWrapper } from "@/components/layout";
import { MinimalSection } from "@/components/sections";
import { CartItemCard } from "@/components/cards";
import { CartPricingInfo } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { getAppPages, getAppConfigs } from "@/db/query";
import { toast } from "sonner"


const AppConfigs = getAppConfigs();
const AppPages = getAppPages();

const CartPage = (): ReactNode => {
  const { title } = AppPages.cart;
  const { cartItems, calculateTotalPrice, calculateTax } = useCart();

  const { currentUser } = useUser()
  const router = useRouter()

  const totalPrice = calculateTotalPrice();
  const tax = calculateTax(totalPrice);
  const totalPriceWithTax = totalPrice + tax;

  const [isCheckingOut, setIsCheckingOut] = useState(false)

    const onCheckout = async () => {
    if (!cartItems.length) return;
    try {
      setIsCheckingOut(true);
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems }), // send as-is
      });
      if (!res.ok) throw new Error(await res.text());
      const { url } = await res.json();
      window.location.href = url; // redirect to Stripe Checkout
    } catch (e) {
      console.error(e);
      toast.error("Could not start checkout");
      setIsCheckingOut(false);
    }
  }

  return (
    <div>
      <title>{`${title || "Cart"}: ${AppConfigs.app_name}`}</title>
      <section>
        <MaxWidthWrapper className="py-8 md:py-12">
          <MinimalSection title={title || "Cart"} className="items-start gap-2">
            <div>
              <Link
                href={`/art`}
                className="mb-1 flex max-w-fit items-center gap-1 text-sm capitalize hover:opacity-85 md:text-lg"
              >
                <ArrowLeft className="size-4 md:size-5" />
                Continue shopping
              </Link>
            </div>

            {cartItems.length > 0 ? (
              <div
                className={cn(
                  "grid grid-cols-1 justify-between gap-4 md:grid-cols-[1fr_minmax(25vw,_250px)]",
                  "mb-6 [&>*>*]:rounded-lg [&>*>*]:border-2",
                )}
              >
                <div className="cart-items-area">
                  <div className="divide-y-2">
                    {cartItems.map((item, index) => (
                      <CartItemCard key={index} item={item} />
                    ))}
                  </div>
                </div>

                <div className="cart-price-info relative -order-1 w-full items-start justify-center md:order-2 md:flex">
                  <CartPricingInfo
                    subtotal={totalPrice / 100}
                    shipping={0}
                    estimatedTax={tax / 100}
                    total={totalPriceWithTax / 100}
                    className="rigt-0 sticky left-0 top-0"
                  >
                    <Button
                      className="mt-4 capitalize md:mx-auto md:mt-6"
                      onClick={onCheckout}
                    >
                      Proceed to Checkout{" "}
                      <ArrowRight className="size-5 !text-background" />
                    </Button>
                  </CartPricingInfo>
                </div>
              </div>
            ) : (
              <div className="grid min-h-[14rem] place-content-center">
                <p className="text-lg md:text-2xl">Your cart is empty</p>
              </div>
            )}
          </MinimalSection>
        </MaxWidthWrapper>
      </section>
    </div>
  );
};

export default CartPage;
