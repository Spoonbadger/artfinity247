"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";

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
          saved(d.message || "Checked");
          router.refresh();
        } catch (e: any) {
          failed(e?.message || "The check failed.", { fix: { label: "See jobs", href: "/admin/jobs" } });
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
