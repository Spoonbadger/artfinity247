"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Something went wrong.");
  return d as { message?: string };
}

/** Resolve / snooze / reopen buttons for one alert. */
export default function AlertActions({ id, state }: { id: string; state: "open" | "snoozed" | "resolved" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(action);
    try {
      const d = await post({ action, id, ...extra });
      toast.success(d.message || "Done");
      router.refresh();
    } catch (e: any) {
      toast.error(e?.message || "Something went wrong.");
    } finally {
      setBusy(null);
    }
  };
  if (state === "resolved") {
    return <button type="button" disabled={!!busy} onClick={() => run("reopen")} className="btn btn-ghost btn-sm">{busy ? "…" : "Reopen"}</button>;
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {state === "snoozed" ? (
        <button type="button" disabled={!!busy} onClick={() => run("unsnooze")} className="btn btn-ghost btn-sm">{busy === "unsnooze" ? "…" : "Unsnooze"}</button>
      ) : (
        <label className="relative">
          <span className="sr-only">Snooze</span>
          <select
            disabled={!!busy}
            value=""
            onChange={(e) => e.target.value && run("snooze", { days: Number(e.target.value) })}
            className="min-h-[36px] cursor-pointer rounded-full border-[1.5px] border-line bg-white px-3 text-[13.5px] font-semibold text-ink hover:border-ink"
          >
            <option value="">{busy === "snooze" ? "Snoozing…" : "Snooze…"}</option>
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">1 week</option>
          </select>
        </label>
      )}
      <button type="button" disabled={!!busy} onClick={() => run("resolve")} className="btn btn-blue btn-sm">{busy === "resolve" ? "…" : "Resolve"}</button>
    </div>
  );
}

/** "Run checks now": the same sweep the daily cron runs (late payouts, stuck orders, stale alerts). */
export function SweepButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch("/api/admin/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sweep" }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || "");
          toast.success(d.message || "Checked");
          router.refresh();
        } catch (e: any) {
          toast.error(e?.message || "The check failed.");
        } finally {
          setBusy(false);
        }
      }}
      className="btn btn-ghost btn-sm"
    >
      {busy ? "Checking…" : "Run checks now"}
    </button>
  );
}
