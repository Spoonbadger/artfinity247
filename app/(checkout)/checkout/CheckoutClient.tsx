"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart, useUser } from "@/components/contexts";
import { CartItemCard } from "@/components/cards";
import { cartArtistNames, lineSavings, startCheckout } from "@/components/art/checkout";
import { checks, emailTypo } from "@/lib/smartFields";
import { failed } from "@/lib/feedback";
import { Problem } from "@/components/studio/Problem";
import PaymentSummary, { type PayRow, type TaxLine } from "@/components/payments/PaymentSummary";
import PayButton from "@/components/payments/PayButton";
import TrustStrip from "@/components/payments/TrustStrip";

/** What the server will charge, priced from the database (/api/create-checkout-session { quote: true }). */
type Quote = {
  lines: { slug: string; size: string; frameChosen: boolean; frameColor: string | null; quantity: number; unit: number }[];
  listTotal: number;
  scanDiscount: number;
  reward: number;
  shipping: number;
  total: number;
  tax: "added" | "none" | "test";
};

export default function CheckoutClient({ tax, collectorEmail = null, reward = null }: { tax: "added" | "none" | "test"; collectorEmail?: string | null; reward?: { code: string; pct: number } | null }) {
  const { cartItems, calculateTotalPrice } = useCart();
  const { currentUser } = useUser();
  const [email, setEmail] = useState(collectorEmail || "");
  const [useReward, setUseReward] = useState(!!reward);
  const [follow, setFollow] = useState(false); // opt-in, never pre-ticked
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  useEffect(() => { if (currentUser?.email) setEmail((e) => e || currentUser.email); }, [currentUser?.email]);

  const rewardCode = reward && useReward && email.trim().toLowerCase() === (collectorEmail || "").toLowerCase() ? reward.code : null;
  const buyer = { id: currentUser?.id, email: email.trim() || null };

  // Re-price on the server whenever the cart or the reward changes, so the total here is the total on Stripe's page.
  const cartKey = useMemo(() => JSON.stringify(cartItems.map((ci) => [ci.product, ci.quantity])), [cartItems]);
  useEffect(() => {
    if (!cartItems.length) { setQuote(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctl.signal,
          body: JSON.stringify({ quote: true, items: cartItems.map((ci) => ({ product: ci.product, quantity: ci.quantity })), buyer: { email: rewardCode ? collectorEmail : null }, ...(rewardCode ? { rewardCode } : {}) }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) { setQuote(null); setQuoteErr(data.error || "We couldn't price your cart. Try again in a moment."); return; }
        setQuoteErr(null);
        setQuote(data as Quote);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setQuote(null);
      }
    }, 150);
    return () => { clearTimeout(t); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, rewardCode]);

  const fallbackTotal = calculateTotalPrice();
  const fallbackSavings = cartItems.reduce((s, ci) => s + lineSavings(ci), 0);
  const total = quote?.total ?? fallbackTotal;
  const taxLine: TaxLine = quote?.tax ?? tax;
  const who = cartArtistNames(cartItems);
  // Lines the server dropped (no longer for sale): they won't be charged, so say so before Pay.
  const gone = quote
    ? cartItems.filter((ci) => !quote.lines.some((l) => l.slug === ci.product.slug && l.size === ci.product.selectedSize && l.frameChosen === !!ci.product.frameChosen))
    : [];
  const repriced = !!quote && !gone.length && quote.total + quote.reward !== fallbackTotal;

  const rows: PayRow[] = [{ label: "Prints", cents: quote ? quote.listTotal : fallbackTotal + fallbackSavings }];
  const scanOff = quote ? quote.scanDiscount : fallbackSavings;
  if (scanOff > 0) rows.push({ label: "Scan discount", cents: -scanOff });
  if (quote && quote.reward > 0) rows.push({ label: "Your reward", cents: -quote.reward });
  rows.push({ label: "Shipping", text: "Free" });

  async function pay(): Promise<boolean> {
    if (!cartItems.length || quoteErr) return false;
    const bad = email.trim() ? checks.email(email) : null;
    if (bad && !emailTypo(email)) { setEmailErr(bad); document.getElementById("receipt-email")?.focus(); return false; }
    try {
      window.location.href = await startCheckout(cartItems, buyer, { follow, rewardCode });
      return true;
    } catch (err) {
      let msg = "Payment didn't open. Nothing was charged.";
      try { msg = JSON.parse((err as Error).message).error || msg; } catch { /* plain text */ }
      failed(msg, { description: "Try again in a moment.", retry: () => void pay() });
      return false;
    }
  }

  if (!cartItems.length) {
    return (
      <div className="mx-auto grid max-w-md justify-items-center gap-3 px-4 py-20 text-center">
        <title>Checkout · Artfinity</title>
        <h1 className="display text-[40px]">Your cart is empty</h1>
        <Link href="/art" className="btn btn-blue">Browse art</Link>
      </div>
    );
  }

  const payDisabled = !!quoteErr;
  return (
    <>
    <title>Checkout · Artfinity</title>
    <form onSubmit={(e) => { e.preventDefault(); void pay(); }} className="mx-auto grid max-w-[1040px] items-start gap-6 px-4 pb-32 pt-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_360px] md:gap-10 md:py-10">
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
        {quoteErr && <Problem tone="error" title={quoteErr} fix={{ label: "Edit cart", href: "/cart" }} />}
        {gone.length > 0 && (
          <Problem tone="warning" title={`${gone.map((g) => g.product.title).join(", ")} ${gone.length === 1 ? "isn't" : "aren't"} for sale any more`} fix={{ label: "Edit cart", href: "/cart" }}>
            It won&apos;t be charged. The total shows the rest.
          </Problem>
        )}
        {repriced && <p className="text-[13.5px] text-ink-2" role="status">Prices changed since you added these. The total shows today&apos;s price.</p>}
        <div className="grid gap-1.5">
          <label className={`af-field${emailErr ? " !border-coral" : ""}`}>
            <span className="label">Email for your receipt</span>
            <input
              id="receipt-email" type="email" name="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
              value={email} onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(null); }}
              onBlur={() => setEmailErr(email.trim() ? checks.email(email) : null)}
              aria-invalid={emailErr ? true : undefined} aria-describedby={emailErr ? "receipt-email-err" : "receipt-email-hint"}
              placeholder="you@example.com"
            />
          </label>
          {emailErr ? (
            <p id="receipt-email-err" className="px-1 text-[13.5px] font-semibold text-coral" aria-live="polite">
              {emailErr}
              {emailTypo(email) && <button type="button" onClick={() => { setEmail(emailTypo(email)!); setEmailErr(null); }} className="ml-2 font-bold text-scan underline underline-offset-2">Use it</button>}
            </p>
          ) : (
            <p id="receipt-email-hint" className="px-1 text-[13px] text-ink-2">No account needed. You can also add it on the next screen.</p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-left text-[14px] leading-snug text-ink">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--af-scan-rgb))]" />
          <span>Email me when {who} {who.includes(" and ") ? "post" : "posts"} new work</span>
        </label>
        {reward && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-sticker bg-sticker/30 px-3 py-2.5 text-left text-[14px] leading-snug text-ink">
            <input type="checkbox" checked={useReward} onChange={(e) => setUseReward(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--af-scan-rgb))]" />
            <span>
              <b>Use your reward: up to {reward.pct}% off</b> (code {reward.code}). Artfinity pays for it, not the artist.
            </span>
          </label>
        )}
      </div>

      <PaymentSummary rows={rows} tax={taxLine} totalCents={total} className="md:sticky md:top-6">
        <span className="hidden md:contents">
          <PayButton type="button" amountCents={total} plusTax={taxLine === "added"} onPay={pay} disabled={payDisabled} className="btn btn-blue btn-lg w-full" />
        </span>
        {taxLine === "test" && (
          <p className="rounded-xl bg-sticker/60 px-3 py-2 text-[13px]">
            <b>Test mode.</b> No card needed: the order is saved as paid.
          </p>
        )}
        {taxLine === "added" && <p className="text-[13px] text-ink-2">Address and payment on the next screen, where Stripe adds the sales tax for your address.</p>}
        <div className="border-t border-line pt-3"><TrustStrip artist={who} /></div>
      </PaymentSummary>

      {/* Phones: Pay stays in reach while the summary scrolls */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
        <PayButton type="button" amountCents={total} plusTax={taxLine === "added"} onPay={pay} disabled={payDisabled} className="btn btn-blue w-full py-3.5 text-[17px]" />
      </div>
    </form>
    </>
  );
}
