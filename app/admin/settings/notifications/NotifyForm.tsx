"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import type { NotifyPref } from "@/lib/alertKinds";

type Row = { kind: string; label: string; defaultLabel: string; value: NotifyPref | null };
const CHOICES: { v: NotifyPref | null; label: string }[] = [
  { v: null, label: "Default" },
  { v: "instant", label: "Right away" },
  { v: "digest", label: "Digest" },
  { v: "off", label: "Off" },
];

/** One row per alert kind: default / right away / daily digest / off. Saves only what differs from the default. */
export default function NotifyForm({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [vals, setVals] = useState<Record<string, NotifyPref | null>>(Object.fromEntries(rows.map((r) => [r.kind, r.value])));
  const [busy, setBusy] = useState(false);
  const dirty = rows.some((r) => vals[r.kind] !== r.value);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const prefs = Object.fromEntries(Object.entries(vals).filter(([, v]) => v));
      const r = await fetch("/api/admin/settings/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefs }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "");
      saved("Saved");
      router.refresh();
    } catch (err: any) {
      failed(err?.message || "Couldn't save.", { description: "Nothing was changed. Try saving again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <ul className="af-card divide-y divide-line p-1 sm:p-2">
        {rows.map((r) => (
          <li key={r.kind} className="grid gap-2 px-2 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{r.label}</p>
              <p className="text-[12.5px] text-ink-2">Default: {r.defaultLabel}</p>
            </div>
            <fieldset className="flex flex-wrap gap-1" aria-label={r.label}>
              {CHOICES.map((c) => {
                const on = vals[r.kind] === c.v;
                return (
                  <label key={c.label} className={cn("flex min-h-[38px] cursor-pointer items-center rounded-full border-[1.5px] px-3 text-[13.5px] font-semibold transition", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
                    <input type="radio" className="sr-only" name={r.kind} checked={on} onChange={() => setVals((x) => ({ ...x, [r.kind]: c.v }))} />
                    {c.label}
                  </label>
                );
              })}
            </fieldset>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || !dirty} className="btn btn-blue">{busy ? "Saving…" : "Save"}</button>
        <button type="button" disabled={busy} onClick={() => setVals(Object.fromEntries(rows.map((r) => [r.kind, null])))} className="text-[13.5px] font-semibold text-ink-2 underline">Reset all to default</button>
      </div>
    </form>
  );
}
