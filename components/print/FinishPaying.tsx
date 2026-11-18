"use client";
// An unpaid mailed code order (My purchases): open a fresh Stripe Checkout, or give up on it.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";

export default function FinishPaying({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "retry" | "cancel">("");
  async function go(action: "retry" | "cancel") {
    setBusy(action);
    try {
      const r = await fetch(`/api/studio/code-orders/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      if (!r.ok) {
        const p = await problemFrom(r, action === "retry" ? "Checkout didn't open. Nothing was charged." : "Couldn't cancel it. Try again.");
        failed(p.message, { fix: p.fix });
        setBusy("");
        return;
      }
      const j = await r.json().catch(() => ({}));
      if (action === "retry" && j.url) { window.location.assign(j.url); return; }
      saved("Order canceled", { description: "Nothing was charged." });
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Something went wrong. Try again."));
    }
    setBusy("");
  }
  return (
    <>
      <button type="button" className="btn btn-blue btn-sm" disabled={!!busy} onClick={() => go("retry")}>{busy === "retry" ? "Opening checkout…" : "Finish paying"}</button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => go("cancel")}>Cancel</button>
    </>
  );
}
