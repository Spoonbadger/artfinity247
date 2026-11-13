"use client";
// Back from Stripe (or a test checkout): one toast that says what happened, through lib/feedback.ts, then the return
// params come off the URL so a refresh doesn't say it again. The page shows the lasting notice next to it.
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { failed, saved } from "@/lib/feedback";

export default function PaymentReturn({
  kind, message, description, strip = ["paid", "canceled", "billing", "session_id", "placed", "stripe"],
}: {
  /** paid: it went through. canceled: they backed out, nothing charged. failed: it didn't go through. info: still confirming. */
  kind: "paid" | "canceled" | "failed" | "info";
  message: string;
  description?: string;
  /** Query params to drop once shown. */
  strip?: string[];
}) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Same toast id per message: React strict mode or a quick re-render never shows it twice.
    const id = `pay-${kind}-${message}`;
    if (kind === "paid") saved(message, { description });
    else if (kind === "failed") failed(message, { description });
    else toast(message, { id, description });
    try {
      const url = new URL(window.location.href);
      let changed = false;
      for (const k of strip) if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; }
      if (changed) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      // leave the URL alone
    }
  }, [kind, message, description, strip]);
  return null;
}
