"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PRO, REFERRALS, dollars } from "@/lib/plans";
import type { BillingView } from "@/lib/billingStatus";
import { cn } from "@/lib/utils";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { startInfinityCheckout } from "./StartInfinityButton";
import PaymentSummary, { type TaxLine } from "@/components/payments/PaymentSummary";
import PayButton from "@/components/payments/PayButton";

type Mode = "live" | "simulated" | "off";
type ViewKind = BillingView["kind"];
type SimAction = "subscribe" | "cancel" | "resume" | "payment_failed" | "payment_fixed" | "end";

/**
 * Infinity billing buttons for /studio/infinity: "Get Infinity" (Stripe Checkout), "Manage billing" (Customer
 * Portal), and in test mode (no Stripe keys, never production) buttons that walk a simulated subscription through
 * its states.
 */
export default function BillingPanel({
  mode, kind, intervals, freeMonthsUntil, onDark = false, autoStart = false, tax,
}: {
  /** Sales tax on the subscription (lib/tax.ts BILLING_TAX_ENABLED): added by Stripe from the billing address. */
  tax?: TaxLine;
  mode: Mode;
  kind: ViewKind;
  intervals: ("month" | "year")[];
  /** Referral or granted months left: billing would start then. */
  freeMonthsUntil?: string | null;
  onDark?: boolean;
  /** From ?start=1 (a "Get Infinity" button elsewhere, or after logging in): open checkout once, no second click. */
  autoStart?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const subscribed = kind === "renews" || kind === "trial" || kind === "cancels" || kind === "payment_failed";

  async function post(key: string, url: string, body?: unknown) {
    setBusy(key);
    setError(null);
    setNote(null);
    const retry = () => post(key, url, body);
    try {
      const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      if (!r.ok) {
        const p = await problemFrom(r, "Billing didn't respond. Try again in a minute.");
        setError(p.message);
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : retry });
        return;
      }
      const d = await r.json().catch(() => ({}));
      if (d.url) {
        window.location.assign(d.url);
        return;
      }
      if (d.message) setNote(d.message);
      saved(d.message || "Done");
      router.refresh();
    } catch {
      const msg = "Couldn't reach Artfinity. Check your connection.";
      setError(msg);
      failed(msg, { retry });
    } finally {
      setBusy(null);
    }
  }

  // The same start as every "Get Infinity" button (StartInfinityButton): Stripe Checkout, or the simulated subscription,
  // then the plan page with ?billing=success so the confirmation shows.
  async function checkout(interval: "month" | "year") {
    if (busy) return;
    setBusy(interval);
    setError(null);
    if (!(await startInfinityCheckout(mode, interval))) setBusy(null);
  }
  const sim = (action: SimAction) => post(action, "/api/studio/infinity/test", { action });

  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    // Drop ?start=1, and remember the start for a few minutes, so Back from Stripe or a refresh doesn't reopen it.
    const url = new URL(window.location.href);
    url.searchParams.delete("start");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    let recent = false;
    try {
      recent = Date.now() - Number(sessionStorage.getItem("af-infinity-start") || 0) < 5 * 60_000;
      sessionStorage.setItem("af-infinity-start", String(Date.now()));
    } catch { /* storage blocked: start anyway */ }
    if (subscribed || mode === "off" || recent) return;
    setBusy("month");
    // Same landing as the buttons elsewhere: Stripe, or in test mode straight to ?billing=success.
    startInfinityCheckout(mode, "month").then((ok) => { if (!ok) setBusy(null); }).catch(() => setBusy(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const ghost = cn("btn btn-ghost btn-sm min-h-[44px] md:min-h-0", onDark && "!border-white !text-white hover:!bg-white hover:!text-ink");
  const muted = onDark ? "text-white/70" : "text-ink-2";

  if (mode === "off") {
    // Paid billing isn't switched on here yet: offer the free way in (referral months) instead of a dead button.
    return (
      <div className="grid justify-items-start gap-2">
        <p className={cn("text-[14px]", muted)}>
          Paying for {PRO.name} isn&apos;t open yet. You can still get it free: each artist who joins with your link and gets going earns you {REFERRALS.rewardMonths} months.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="#referrals" className="btn btn-blue btn-sm min-h-[44px] md:min-h-0">Get {PRO.name} free</a>
          <a href="/contact" className={ghost}>Tell me when it opens</a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid justify-items-start gap-2.5">
      {subscribed ? (
        mode === "live" ? (
          <button type="button" className={cn(kind === "payment_failed" ? "btn btn-blue btn-lg" : ghost)} disabled={!!busy} onClick={() => post("portal", "/api/studio/infinity/portal")}>
            {busy === "portal" ? "Opening…" : kind === "payment_failed" ? "Update card" : "Manage billing"}
          </button>
        ) : (
          <span className={cn("text-[13px]", muted)}>Manage billing opens Stripe’s customer portal once Stripe keys are set. Use the test buttons below.</span>
        )
      ) : (
        <PaymentSummary
          title={null}
          className="max-w-[420px] text-ink"
          lines={[{ key: "infinity", title: `${PRO.name}, monthly`, detail: "Renews each month. Cancel anytime.", amountCents: PRO.priceCents }]}
          tax={tax ?? (mode === "simulated" ? "test" : "added")}
          totalLabel={freeMonthsUntil ? "Due today" : undefined}
          totalCents={freeMonthsUntil ? 0 : PRO.priceCents}
          footer={freeMonthsUntil ? `Your free months run first: the first charge is ${freeMonthsUntil}.` : mode === "simulated" ? "Test mode: no card, no money." : "Billed by Stripe. Cancel from Manage billing; you keep it to the end of the month you paid for."}
        >
          <PayButton
            amountCents={PRO.priceCents}
            label={freeMonthsUntil ? `Get ${PRO.name}` : undefined}
            plusTax={(tax ?? (mode === "simulated" ? "test" : "added")) === "added"}
            busy={busy === "month"}
            disabled={!!busy}
            onPay={() => checkout("month")}
            busyLabel="Starting…"
            className="btn btn-blue btn-lg w-full"
          />
          {intervals.includes("year") && (
            <button type="button" className={cn(ghost, "!text-ink !border-ink hover:!bg-ink hover:!text-white")} disabled={!!busy} onClick={() => checkout("year")}>
              {busy === "year" ? "Starting…" : `Or ${dollars(PRO.yearlyMonthlyCents)}/mo, billed yearly (${dollars(PRO.yearlyMonthlyCents * 12)})`}
            </button>
          )}
        </PaymentSummary>
      )}

      {mode === "simulated" && (
        <div className={cn("grid gap-2 rounded-xl border border-dashed p-3", onDark ? "border-white/40" : "border-ink/30")}>
          <span className={cn("text-[12px] font-bold uppercase tracking-[0.06em]", muted)}>Test mode · no Stripe keys, no money</span>
          <div className="flex flex-wrap gap-2">
            {!subscribed && <span className={cn("text-[13px]", muted)}>The Pay button above subscribes (test).</span>}
            {(kind === "renews" || kind === "trial") && <TestButton label="Cancel (test)" busy={busy === "cancel"} disabled={!!busy} onClick={() => sim("cancel")} className={ghost} />}
            {kind === "cancels" && <TestButton label="Undo cancel (test)" busy={busy === "resume"} disabled={!!busy} onClick={() => sim("resume")} className={ghost} />}
            {subscribed && kind !== "payment_failed" && <TestButton label="Payment failed (test)" busy={busy === "payment_failed"} disabled={!!busy} onClick={() => sim("payment_failed")} className={ghost} />}
            {kind === "payment_failed" && <TestButton label="Payment works (test)" busy={busy === "payment_fixed"} disabled={!!busy} onClick={() => sim("payment_fixed")} className={ghost} />}
            {subscribed && <TestButton label="End now (test)" busy={busy === "end"} disabled={!!busy} onClick={() => sim("end")} className={ghost} />}
          </div>
        </div>
      )}
      {note && <span role="status" className={cn("text-[13px] font-semibold", onDark ? "text-white" : "text-earned")}>{note}</span>}
      {error && <span role="alert" className={cn("text-[13px] font-semibold", onDark ? "text-sticker" : "text-coral")}>{error}</span>}
    </div>
  );
}

function TestButton({ label, busy, disabled, onClick, className }: { label: string; busy: boolean; disabled: boolean; onClick: () => void; className: string }) {
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {busy ? "Working…" : label}
    </button>
  );
}
