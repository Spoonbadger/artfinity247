"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { useAdminCan } from "../../_components/AdminRole";
import { TRUST_LIMITS, type TrustSettings } from "@/lib/trust/config";

/** The two switches and three numbers (lib/trust/config.ts), saved through /api/admin/settings/trust. */
export default function TrustForm({ value, providerReady, verifyReady }: { value: TrustSettings; providerReady: boolean; verifyReady: boolean }) {
  const router = useRouter();
  const canEdit = useAdminCan("settings");
  const [v, setV] = useState<TrustSettings>(value);
  const [busy, setBusy] = useState(false);
  const changed = (Object.keys(value) as (keyof TrustSettings)[]).some((k) => v[k] !== value[k]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings/trust", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      saved("Auto-approval saved");
      router.refresh();
    } catch (err) {
      failed((err as Error).message, { description: "Nothing was changed. Try saving again." });
    } finally {
      setBusy(false);
    }
  };

  const toggle = (k: "autoApprove" | "autoVerify", label: string, help: string, ready: boolean) => (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" role="switch" checked={v[k]} disabled={!canEdit} onChange={(e) => setV({ ...v, [k]: e.target.checked })} className="mt-0.5 h-[18px] w-[18px] accent-[rgb(var(--af-scan-rgb))]" />
      <span className="grid gap-0.5">
        <b className="text-[15px]">{label}</b>
        <span className="text-[13.5px] text-ink-2">{help}</span>
        {v[k] && !ready && <span className="text-[13.5px] font-semibold text-coral">{k === "autoVerify" ? "Needs a photo check that sees faces (IMAGE_MODERATION_EXTRA=sightengine)" : "Needs IMAGE_MODERATION_PROVIDER"}. Until then, everything comes to you.</span>}
      </span>
    </label>
  );

  const num = (k: "spotCheckEvery" | "velocityN" | "minAccountDays", label: string, help: string) => (
    <label className="grid gap-1 text-[13.5px] font-semibold">
      {label}
      <input type="number" inputMode="numeric" min={TRUST_LIMITS[k].min} max={TRUST_LIMITS[k].max} value={v[k]} disabled={!canEdit}
        onChange={(e) => setV({ ...v, [k]: Math.round(Number(e.target.value)) })}
        className="min-h-[40px] w-28 rounded-lg border-[1.5px] border-[var(--af-field-edge)] bg-white px-2 text-[15px] text-ink" />
      <span className="font-normal text-ink-2">{help}</span>
    </label>
  );

  return (
    <form onSubmit={save} className="af-panel grid gap-5 p-4 sm:p-5" aria-label="Auto-approval settings">
      <div className="grid gap-4">
        {toggle("autoApprove", "Auto-approve artwork", "Clean uploads go live. Anything flagged comes to you.", providerReady)}
        {toggle("autoVerify", "Auto-verify artists", "Artists who pass every check get the seal.", verifyReady)}
      </div>
      <div className="flex flex-wrap gap-5">
        {num("spotCheckEvery", "Spot check 1 in", "Auto-approved pieces to look at. 0 = off.")}
        {num("velocityN", "New artist uploads a day", "Past this, the rest wait.")}
        {num("minAccountDays", "Account age (days)", "To auto-verify. Younger counts as new.")}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy || !changed || !canEdit} title={canEdit ? undefined : "Only an owner can change settings."} className="btn btn-blue btn-sm">
          {busy ? "Saving…" : "Save"}
        </button>
        {!canEdit && <span className="t-small">Only an owner can change this.</span>}
      </div>
    </form>
  );
}
