"use client";
// "Pay $X" on the Studio-wide scan banner: opens checkout in one click, the same call as the button on the booking
// card in /studio/scanning (no stop on the bookings page first).
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { usd } from "@/lib/scanning";

export default function ScanPayButton({ id, priceCents, className = "btn btn-blue btn-sm" }: { id: string; priceCents: number; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    try {
      const res = await fetch(`/api/studio/scanning/${id}/pay`, { method: "POST" });
      const data = (await res.clone().json().catch(() => ({}))) as { url?: string; dev?: boolean };
      if (!res.ok || !data.url) {
        const p = await problemFrom(res, "Checkout didn't open. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : pay });
        setBusy(false);
        return;
      }
      if (data.dev) saved("Paid (test mode)", { description: "No card was charged: Stripe isn't set up here." });
      window.location.assign(data.url);
    } catch (err) {
      failed(errorText(err, "Checkout didn't open. Try again."), { retry: pay });
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={pay} disabled={busy} aria-busy={busy} className={className}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {busy ? "Opening…" : `Pay ${usd(priceCents)}`}
    </button>
  );
}
