"use client";
// Back from Stripe without paying. Nothing was charged and the cart is untouched (it's only emptied once an order is
// paid), so one button takes them straight back to checkout.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/components/contexts";

export default function CancelClient() {
  const { cartItems } = useCart();
  // The cart loads from this device after the first render: wait for it before choosing the button.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const n = cartItems.reduce((s, ci) => s + (ci.quantity || 1), 0);
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 px-4 py-16 text-center md:py-24">
      <title>Nothing was charged · Artfinity</title>
      <div className="h-28 w-[88px] rotate-[-4deg] rounded-[3px] border-[8px] border-ink bg-gallery shadow-[0_14px_28px_-10px_rgba(21,22,27,.45)]" aria-hidden />
      <h1 className="t-page">Nothing was charged</h1>
      <p className={`t-body text-ink-2 ${ready ? "" : "invisible"}`}>{n ? `Your cart is saved: ${n} ${n === 1 ? "print" : "prints"}.` : "You can pick up where you left off any time."}</p>
      <Link href={n ? "/checkout" : "/art"} className={`btn btn-blue ${ready ? "" : "invisible"}`}>{n ? "Back to checkout" : "Browse art"}</Link>
      {n > 0 && <Link href="/art" className="t-small font-semibold underline underline-offset-2 hover:text-ink">Keep looking</Link>}
    </div>
  );
}
