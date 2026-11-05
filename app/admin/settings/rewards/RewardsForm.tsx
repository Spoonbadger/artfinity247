"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminCan } from "../../_components/AdminRole";

type V = { enabled: boolean; every: number; pct: number };

/** Collector rewards on/off, prints per reward and the discount (saved to data/admin-settings.json). */
export default function RewardsForm({ value }: { value: V }) {
  const router = useRouter();
  const canEdit = useAdminCan("settings");
  const [v, setV] = useState<V>(value);
  const [busy, setBusy] = useState(false);
  const changed = v.enabled !== value.enabled || v.every !== value.every || v.pct !== value.pct;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings/rewards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      toast.success(v.enabled ? `Rewards on: every ${v.every}th print, ${v.pct}% off` : "Rewards off");
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="grid gap-4 rounded-2xl border border-line bg-white p-5">
      <label className="flex cursor-pointer items-center gap-2.5 text-[15px] font-semibold">
        <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="h-[18px] w-[18px] accent-[rgb(var(--af-scan-rgb))]" />
        Rewards on
      </label>
      <div className="flex flex-wrap gap-4">
        <label className="grid gap-1 text-[12.5px] font-semibold">
          Every Nth print earns a reward
          <input type="number" min={2} max={50} value={v.every} onChange={(e) => setV({ ...v, every: Number(e.target.value) })} className="min-h-[38px] w-28 rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] text-ink" />
        </label>
        <label className="grid gap-1 text-[12.5px] font-semibold">
          Discount on the next order (%)
          <input type="number" min={5} max={30} value={v.pct} onChange={(e) => setV({ ...v, pct: Number(e.target.value) })} className="min-h-[38px] w-28 rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] text-ink" />
        </label>
      </div>
      <p className="text-[13px] text-ink-2">Buyers read: &ldquo;Every {v.every}th print earns {v.pct}% off your next order.&rdquo;</p>
      <button type="submit" disabled={busy || !changed || !canEdit} title={canEdit ? undefined : "Only an owner can change settings."} className="btn btn-blue btn-sm w-fit">
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
