"use client";
// Print codes: "Mail them to me". Exactly the cards on screen, printed by us, laminated, cut and mailed at cost.
// Posts to /api/studio/print/order, which re-checks every line and the price, then opens Stripe Checkout.
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Truck } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { US_STATES, cardWords, type CodePrintPricing, type Quote, type ShipAddress } from "@/lib/printQueueFormat";
import { cn } from "@/lib/utils";
import PaymentSummary from "@/components/payments/PaymentSummary";
import PayButton from "@/components/payments/PayButton";

const JSON_HEADERS = { "Content-Type": "application/json" };
const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function MailOrder({ quote, infinity, pricing, address, testMode, lines, onPriceChange }: {
  quote: Quote; infinity: boolean; pricing: CodePrintPricing; address: ShipAddress; testMode: boolean;
  /** The cards on the Print codes screen, as sent to /api/studio/print/order. */
  lines: { artworkId: string; code: string | null; size: string; copies: number }[];
  onPriceChange: () => void;
}) {
  const [a, setA] = useState<ShipAddress>(address);
  const [bad, setBad] = useState<keyof ShipAddress | null>(null);
  const [badMsg, setBadMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const refs = useRef<Partial<Record<keyof ShipAddress, HTMLInputElement | HTMLSelectElement | null>>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof ShipAddress, v: string) => { setA((o) => ({ ...o, [k]: v })); if (bad === k) setBad(null); };

  async function order(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/studio/print/order", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ lines, address: a, expectTotal: quote.total }) });
      if (!r.ok) {
        const j = await r.clone().json().catch(() => ({}));
        const p = await problemFrom(r, "Checkout didn't open. Nothing was charged. Try again.");
        if (p.code === "address_required" && j.field) {
          setBad(j.field);
          setBadMsg(p.message);
          refs.current[j.field as keyof ShipAddress]?.focus();
          failed(p.message, { description: "Add it below, then order again." });
        } else if (p.code === "price_changed") {
          failed(p.message, { description: `New total: ${usd(j.total ?? 0)}.` });
          onPriceChange();
        } else failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => formRef.current?.requestSubmit() });
        setBusy(false);
        return;
      }
      const j = await r.json();
      if (j.dev) saved("Test order placed", { description: "No Stripe keys here, so it's recorded as paid without charging." });
      window.location.assign(j.url);
      return; // stays busy while the next page opens, so a second click can't order twice
    } catch (err) {
      failed(errorText(err, "Checkout didn't open. Nothing was charged."), { retry: () => formRef.current?.requestSubmit() });
    }
    setBusy(false);
  }

  const field = (k: keyof ShipAddress, label: string, opts: { auto: string; optional?: boolean; className?: string; inputMode?: "numeric" } = { auto: "" }) => (
    <label className={cn("grid min-w-0 gap-1 text-[13px] font-semibold", opts.className)}>
      <span>{label}{opts.optional && <span className="font-normal text-ink-2"> (optional)</span>}</span>
      <input
        ref={(el) => { refs.current[k] = el; }}
        name={k} value={a[k]} onChange={(e) => set(k, e.target.value)} autoComplete={opts.auto ? `shipping ${opts.auto}` : undefined} inputMode={opts.inputMode} required={!opts.optional}
        aria-invalid={bad === k || undefined} aria-describedby={bad === k ? "ship-err" : undefined}
        className={cn("min-h-[42px] w-full min-w-0 rounded-lg border-[1.5px] bg-white px-2.5 text-[15px] font-normal text-ink", bad === k ? "border-coral" : "border-line")}
      />
      {bad === k && <span id="ship-err" role="alert" className="text-[13px] font-semibold text-coral">{badMsg}</span>}
    </label>
  );

  return (
    <section aria-labelledby="mail-h" className="af-card grid gap-4 p-4 sm:p-5">
      <div className="grid gap-1">
        <h2 id="mail-h" className="flex items-center gap-2 t-card"><Truck className="h-5 w-5" aria-hidden="true" />Mail them to me</h2>
        <p className="t-muted">Laminated, pre-cut and mailed to you, ready to hang.</p>
      </div>

      <PaymentSummary
        title={null}
        className="border border-line p-3 sm:p-4"
        rows={[
          ...quote.lines.map((l) => ({ label: <>{cardWords(l.format, l.qty)} <span className="text-ink-2">× {usd(l.unit)}</span></>, cents: l.total })),
          { label: <>Shipping{quote.freeShipping && <span className="text-ink-2"> · free with Infinity</span>}</>, ...(quote.freeShipping ? { text: "Free" } : { cents: quote.shipping }) },
          ...(quote.handling > 0 ? [{ label: "Handling", cents: quote.handling }] : []),
        ]}
        tax={testMode ? "test" : "none"}
        totalCents={quote.total}
        footer={<span className="font-semibold text-earned">At cost: we don&apos;t make money on these.</span>}
      />
      {!infinity && pricing.infinityFreeShipping && <p className="text-[13px] text-ink-2">Shipping is free on the <Link href="/studio/infinity" className="font-semibold text-scan">Infinity plan</Link>.</p>}

      <form ref={formRef} id="ship" onSubmit={order} className="grid scroll-mt-24 gap-3" noValidate>
        <fieldset className="grid grid-cols-6 gap-2.5">
          <legend className="mb-1 text-[14px] font-bold">Mail them to</legend>
          {field("name", "Name", { auto: "name", className: "col-span-6" })}
          {field("line1", "Street address", { auto: "address-line1", className: "col-span-6" })}
          {field("line2", "Apt, suite, studio", { auto: "address-line2", optional: true, className: "col-span-6" })}
          {field("city", "City", { auto: "address-level2", className: "col-span-6 sm:col-span-3 lg:col-span-6" })}
          <label className="col-span-3 grid min-w-0 gap-1 text-[13px] font-semibold sm:col-span-1 lg:col-span-3">
            State
            <select
              ref={(el) => { refs.current.state = el; }}
              name="state" value={a.state} onChange={(e) => set("state", e.target.value)} autoComplete="shipping address-level1" aria-invalid={bad === "state" || undefined} aria-describedby={bad === "state" ? "ship-err" : undefined}
              className={cn("min-h-[42px] w-full min-w-0 rounded-lg border-[1.5px] bg-white px-2 text-[15px] font-normal text-ink", bad === "state" ? "border-coral" : "border-line")}
            >
              <option value="">State</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {bad === "state" && <span id="ship-err" role="alert" className="text-[13px] font-semibold text-coral">{badMsg}</span>}
          </label>
          {field("zip", "ZIP", { auto: "postal-code", inputMode: "numeric", className: "col-span-3 sm:col-span-2 lg:col-span-3" })}
        </fieldset>
        <p className="text-[13px] text-ink-2">US addresses only. We mail them with tracking.</p>
        <PayButton type="submit" amountCents={quote.total} busy={busy} disabled={!quote.cards} className="btn btn-blue w-full" />
        <p className="text-[13px] text-ink-2">{testMode ? "Test mode: saved as paid, no card needed." : "Secure payment by Stripe: Apple Pay, Google Pay or card."} We email your receipt, then tracking when they ship.</p>
      </form>
    </section>
  );
}
