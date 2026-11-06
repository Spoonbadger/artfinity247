"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { useAdminCan } from "../_components/AdminRole";

type Policy = "absorb" | "deduct_next_payout";
const CHOICES: { v: Policy; title: string; body: string }[] = [
  { v: "absorb", title: "Artfinity absorbs it", body: "The artist keeps the share they were already paid. Nothing changes on their Money page." },
  {
    v: "deduct_next_payout",
    title: "Take it off their next payout",
    body: "Their share shows as a “Refund adjustment” on their Money page and comes off their next payout. A payout never goes below $0; the rest carries to the month after.",
  },
];

/** Owner setting: paid-out refunds (lib/refundPolicy.ts). Saved through /api/admin/settings. */
export default function RefundPolicyForm({ value }: { value: Policy }) {
  const router = useRouter();
  const canEdit = useAdminCan("settings");
  const [v, setV] = useState<Policy>(value);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refundPaidOutPolicy: v }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      saved("Refund setting saved");
      router.refresh();
    } catch (err: any) {
      failed(err?.message || "Couldn't save.", { description: "Nothing was changed. Try saving again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-3">
      <fieldset className="grid gap-2" aria-label="When a paid-out sale is refunded">
        {CHOICES.map((c) => {
          const on = v === c.v;
          return (
            <label key={c.v} className={cn("flex cursor-pointer gap-3 rounded-xl border-[1.5px] p-3", on ? "border-ink bg-wall" : "border-edge-strong bg-white hover:border-ink", !canEdit && "cursor-not-allowed opacity-70")}>
              <input type="radio" name="refundPaidOutPolicy" value={c.v} checked={on} disabled={!canEdit} onChange={() => setV(c.v)} className="mt-1 h-4 w-4 accent-ink" />
              <span className="grid gap-0.5">
                <b className="text-[15px]">{c.title}{c.v === "absorb" && <span className="ml-1.5 text-[13px] font-semibold text-ink-2">(default)</span>}</b>
                <span className="text-[13.5px] text-ink-2">{c.body}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || v === value || !canEdit} title={canEdit ? undefined : "Only an owner can change settings."} className="btn btn-blue btn-sm">
          {busy ? "Saving…" : "Save"}
        </button>
        {canEdit ? <span className="t-small">Applies to refunds recorded from now on. Past ones don&apos;t change.</span> : <span className="t-small">Only an owner can change this.</span>}
      </div>
    </form>
  );
}
