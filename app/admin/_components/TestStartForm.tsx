"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Sets the 90-day test's start date (saved to data/admin-settings.json). */
export default function TestStartForm({ value }: { value: string }) {
  const router = useRouter();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testStartDate: v }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      toast.success(v ? `Test starts ${v}` : "Test starts at the first order");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="flex flex-wrap items-end gap-2 border-t border-dashed border-line pt-3">
      <label className="grid gap-1 text-[12.5px] font-semibold">
        Start date
        <input type="date" value={v} onChange={(e) => setV(e.target.value)} className="min-h-[38px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] text-ink" />
      </label>
      <button type="submit" disabled={busy || v === value} className="btn btn-ghost btn-sm">Save</button>
      {value && <button type="button" disabled={busy} onClick={() => setV("")} className="text-[12.5px] font-semibold text-ink-2 underline">Use first order</button>}
    </form>
  );
}
