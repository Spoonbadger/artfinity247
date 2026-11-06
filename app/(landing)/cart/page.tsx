"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useCart, useUser } from "@/components/contexts";
import { CartItemCard, CartPricingInfo } from "@/components/cards";
import { usd } from "@/components/art/pricing";
import { cartArtistNames, lineSavings, startCheckout } from "@/components/art/checkout";
import { deliveryRange } from "@/lib/delivery";
import { EmptyState } from "@/components/studio/EmptyState";

export default function CartPage() {
  const { cartItems, calculateTotalPrice } = useCart();
  const { currentUser } = useUser();
  const [busy, setBusy] = useState(false);
  const [follow, setFollow] = useState(false); // opt-in, never pre-ticked

  const total = calculateTotalPrice();
  const savings = cartItems.reduce((s, ci) => s + lineSavings(ci), 0);
  const count = cartItems.reduce((n, ci) => n + ci.quantity, 0);
  const who = cartArtistNames(cartItems);

  const onCheckout = async () => {
    if (!cartItems.length || busy) return;
    setBusy(true);
    try {
      window.location.href = await startCheckout(cartItems, { id: currentUser?.id, email: currentUser?.email }, { follow });
    } catch (e) {
      console.error(e);
      toast.error("Checkout didn't open. Try again in a moment.");
      setBusy(false);
    }
  };

  return (
    <>
      <title>Cart · Artfinity</title>
      {/* the cookie notice waits for the first scroll, so it doesn't cover the summary on phones */}
      <style>{`:root { --af-cookie-wait: 1; }`}</style>
      <div className="mx-auto max-w-[1040px] px-4 pb-16 pt-6 sm:px-6 md:pt-10">
        <Link href="/art" className="mb-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 no-underline hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Keep looking
        </Link>
        <h1 className="t-page mb-6">
          Your cart{count > 0 && <span className="text-ink-2"> · {count}</span>}
        </h1>

        {cartItems.length ? (
          <div className="grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
            <div className="divide-y divide-line border-y border-line">
              {cartItems.map((item) => (
                <CartItemCard key={`${item.product.id}-${item.product.selectedSize}-${item.product.frameChosen}-${item.product.frameColor}`} item={item} />
              ))}
            </div>
            <CartPricingInfo subtotal={total / 100} savings={savings / 100} shipping={0} total={total / 100} className="md:sticky md:top-24">
              <label className="flex cursor-pointer items-start gap-2.5 text-left text-[14px] leading-snug text-ink">
                <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--af-scan-rgb))]" />
                <span>Email me when {who} {who.includes(" and ") ? "post" : "posts"} new work</span>
              </label>
              <button type="button" onClick={onCheckout} disabled={busy} className="btn btn-blue btn-lg w-full">
                {busy ? "Opening checkout…" : `Check out · ${usd(total)}`}
              </button>
              <p className="t-small text-center">
                Printed in NYC, arrives {deliveryRange()} · tax added at checkout ·{" "}
                <Link href="/help/buyers/damaged-print" className="underline underline-offset-2 hover:text-ink">damaged? free reprint</Link>
              </p>
            </CartPricingInfo>
          </div>
        ) : (
          <EmptyState
            title="Nothing here yet"
            body="Scan a code next to a painting, or browse."
            action={{ label: "Browse art", href: "/art" }}
            className="justify-items-center py-12 text-center sm:py-16"
          />
        )}
      </div>
    </>
  );
}
