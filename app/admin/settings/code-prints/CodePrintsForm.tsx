"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminCan } from "../../_components/AdminRole";
import { FORMATS } from "@/components/qr/card";
import { FORMAT_ORDER, quoteFor, type CodePrintPricing } from "@/lib/printQueueFormat";

const toDollars = (c: number) => (c / 100).toFixed(2);
const toCents = (s: string) => Math.max(0, Math.round(parseFloat(s || "0") * 100) || 0);
const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Per-card cost per format, flat shipping, optional handling, Infinity free shipping. Saved through /api/admin/settings/code-prints. */
export default function CodePrintsForm({ value, placeholder }: { value: CodePrintPricing; placeholder: boolean }) {
  const router = useRouter();
  const canEdit = useAdminCan("settings");
  const [v, setV] = useState(() => ({
    unit: Object.fromEntries(FORMAT_ORDER.map((f) => [f, toDollars(value.unit[f])])) as Record<string, string>,
    shipping: toDollars(value.shipping), handling: toDollars(value.handling), infinityFreeShipping: value.infinityFreeShipping,
  }));
  const [busy, setBusy] = useState(false);
  const pricing: CodePrintPricing = {
    unit: Object.fromEntries(FORMAT_ORDER.map((f) => [f, toCents(v.unit[f])])) as CodePrintPricing["unit"],
    shipping: toCents(v.shipping), handling: toCents(v.handling), infinityFreeShipping: v.infinityFreeShipping,
  };
  const example = quoteFor({ label: 10 }, pricing);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings/code-prints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pricing) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      toast.success("Code print prices saved", { description: "Artists see them on their print queue now." });
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const money = (label: string, val: string, on: (s: string) => void, hint?: string) => (
    <label className="grid gap-1 text-[13px] font-semibold">
      {label}
      <span className="flex items-center gap-1">
        <span aria-hidden="true" className="text-ink-2">$</span>
        <input type="number" min={0} step="0.01" inputMode="decimal" value={val} onChange={(e) => on(e.target.value)} disabled={!canEdit}
          className="min-h-[38px] w-28 rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] text-ink" />
      </span>
      {hint && <span className="text-[12px] font-normal text-ink-2">{hint}</span>}
    </label>
  );

  return (
    <form onSubmit={save} className="grid gap-5 rounded-2xl border border-line bg-white p-5">
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[16px] font-bold">Per card, printed, laminated and cut{placeholder && <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-sticker px-2 py-0.5 text-[11.5px] font-bold">set by Craig</span>}</legend>
        <div className="flex flex-wrap gap-4">
          {FORMAT_ORDER.map((f) => <div key={f}>{money(`${FORMATS[f].name} (${FORMATS[f].w} × ${FORMATS[f].h} in)`, v.unit[f], (s) => setV({ ...v, unit: { ...v.unit, [f]: s } }))}</div>)}
        </div>
      </fieldset>
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-[16px] font-bold">Per order{placeholder && <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-sticker px-2 py-0.5 text-[11.5px] font-bold">set by Craig</span>}</legend>
        <div className="flex flex-wrap gap-4">
          {money("Shipping (flat)", v.shipping, (s) => setV({ ...v, shipping: s }), "Postage and envelope, with tracking.")}
          {money("Handling", v.handling, (s) => setV({ ...v, handling: s }), "Optional. Leave at 0 for none.")}
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[14.5px] font-semibold">
          <input type="checkbox" checked={v.infinityFreeShipping} disabled={!canEdit} onChange={(e) => setV({ ...v, infinityFreeShipping: e.target.checked })} className="h-[18px] w-[18px] accent-[rgb(var(--af-scan-rgb))]" />
          <span>Free shipping for Infinity artists <span className="font-normal text-ink-2">(off by default)</span></span>
        </label>
      </fieldset>
      <p className="rounded-xl bg-wall p-3 text-[13.5px]">
        Example: 10 wall labels = {usd(example.subtotal)} + {usd(example.shipping)} shipping{example.handling ? ` + ${usd(example.handling)} handling` : ""} = <b>{usd(example.total)}</b>.
      </p>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !canEdit} title={canEdit ? undefined : "Only an owner can change settings."} className="btn btn-blue btn-sm w-fit">
          {busy ? "Saving…" : placeholder ? "Save real prices" : "Save"}
        </button>
        {!canEdit && <span className="text-[13px] text-ink-2">Only an owner can change this.</span>}
      </div>
    </form>
  );
}
