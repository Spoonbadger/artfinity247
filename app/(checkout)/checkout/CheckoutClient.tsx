"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useCart, useUser } from "@/components/contexts";
import { CartItemCard, CartPricingInfo } from "@/components/cards";
import { usd } from "@/components/art/pricing";
import { cartArtistNames, lineSavings, startCheckout } from "@/components/art/checkout";
import { checks, emailTypo } from "@/lib/smartFields";

export default function CheckoutClient({ testMode, collectorEmail = null, reward = null }: { testMode: boolean; collectorEmail?: string | null; reward?: { code: string; pct: number } | null }) {
  const { cartItems, calculateTotalPrice } = useCart();
  const { currentUser } = useUser();
  const [email, setEmail] = useState(collectorEmail || "");
  const [useReward, setUseReward] = useState(!!reward);
  const [busy, setBusy] = useState(false);
  const [follow, setFollow] = useState(false); // opt-in, never pre-ticked
  const [emailErr, setEmailErr] = useState<string | null>(null);
  useEffect(() => { if (currentUser?.email) setEmail((e) => e || currentUser.email); }, [currentUser?.email]);

  const total = calculateTotalPrice();
  const savings = cartItems.reduce((s, ci) => s + lineSavings(ci), 0);
  const who = cartArtistNames(cartItems);

  const onPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartItems.length || busy) return;
    const bad = email.trim() ? checks.email(email) : null;
    if (bad && !emailTypo(email)) { setEmailErr(bad); return; }
    setBusy(true);
    try {
      const rewardCode = reward && useReward && email.trim().toLowerCase() === (collectorEmail || "").toLowerCase() ? reward.code : null;
      window.location.href = await startCheckout(cartItems, { id: currentUser?.id, email: email.trim() || null }, { follow, rewardCode });
    } catch (err) {
      console.error(err);
      toast.error("Payment didn't open. Try again in a moment.");
      setBusy(false);
    }
  };

  if (!cartItems.length) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-3 px-4 py-20 text-center">
        <h1 className="display text-[40px]">Your cart is empty</h1>
        <Link href="/art" className="btn btn-blue">Browse art</Link>
      </div>
    );
  }

  return (
    <>
    <title>Checkout · Artfinity</title>
    <form onSubmit={onPay} className="mx-auto grid max-w-[1040px] items-start gap-6 px-4 pb-32 pt-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_360px] md:gap-10 md:py-10">
      <div className="grid gap-5">
        <div className="flex items-end justify-between gap-3">
          <h1 className="display text-[40px] md:text-[52px]">Checkout</h1>
          <Link href="/cart" className="pb-1.5 text-[14px] font-semibold text-ink-2 hover:text-ink">Edit cart</Link>
        </div>
        <div className="divide-y divide-line rounded-2xl border border-line bg-white px-4">
          {cartItems.map((item) => (
            <CartItemCard key={`${item.product.id}-${item.product.selectedSize}-${item.product.frameChosen}-${item.product.frameColor}`} item={item} readOnly />
          ))}
        </div>
        <div className="grid gap-1.5">
          <label className={`af-field${emailErr ? " !border-coral" : ""}`}>
            <span className="label">Email for your receipt</span>
            <input
              type="email" name="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              value={email} onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); }}
              onBlur={() => setEmailErr(email.trim() ? checks.email(email) : null)}
              aria-invalid={emailErr ? true : undefined} aria-describedby={emailErr ? "receipt-email-err" : undefined}
              placeholder="you@example.com"
            />
          </label>
          {emailErr && (
            <p id="receipt-email-err" className="px-1 text-[13.5px] font-semibold text-coral" aria-live="polite">
              {emailErr}
              {emailTypo(email) && <button type="button" onClick={() => { setEmail(emailTypo(email)!); setEmailErr(null); }} className="ml-2 font-bold text-scan underline underline-offset-2">Use it</button>}
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-left text-[14px] leading-snug text-ink">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--af-scan-rgb))]" />
          <span>Email me when {who} {who.includes(" and ") ? "post" : "posts"} new work</span>
        </label>
        {reward && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border-[1.5px] border-ink bg-sticker/40 px-3 py-2.5 text-left text-[14px] leading-snug text-ink">
            <input type="checkbox" checked={useReward} onChange={(e) => setUseReward(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--af-scan-rgb))]" />
            <span>
              <b>Use your reward: up to {reward.pct}% off</b> (code {reward.code}). Artfinity pays for it, not the artist.
            </span>
          </label>
        )}
      </div>

      <CartPricingInfo subtotal={total / 100} savings={savings / 100} shipping={0} total={total / 100} className="md:sticky md:top-6">
        <button type="submit" disabled={busy} className="btn btn-blue btn-lg hidden w-full md:inline-flex">
          {busy ? "Opening payment…" : `Pay ${usd(total)}`}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[13px] text-ink-2">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Apple Pay · Google Pay · Card
        </p>
        {testMode ? (
          <p className="rounded-xl bg-sticker/60 px-3 py-2 text-[13px]">
            <b>Test mode.</b> No card needed: the order is saved as paid.
          </p>
        ) : (
          <p className="text-center text-[12.5px] text-ink-2">Address, tax and payment on the next screen.</p>
        )}
      </CartPricingInfo>

      {/* Phones: Pay stays in reach while the summary scrolls */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <button type="submit" disabled={busy} className="btn btn-blue w-full py-3.5 text-[17px]">
          {busy ? "Opening payment…" : `Pay ${usd(total)}`}
        </button>
      </div>
    </form>
    </>
  );
}
