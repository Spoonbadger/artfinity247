"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";

/** "Run now" for one job (POST /api/admin/jobs/run). Shows the job's summary as a toast and refreshes the list. */
export default function RunNowButton({ job, label, disabled, reason }: { job: string; label: string; disabled?: boolean; reason?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/jobs/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) saved(d.message || "Done");
      else failed(d.message || d.error || "The job failed", { fix: { label: "See alerts", href: "/admin/alerts" } });
    } catch {
      failed("Couldn't reach the server", { retry: run });
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  return (
    <button type="button" onClick={run} disabled={busy || disabled} title={disabled ? reason : undefined} aria-label={`Run ${label} now`} className="btn btn-ghost btn-sm min-h-[40px] shrink-0">
      {busy ? "Running…" : "Run now"}
    </button>
  );
}
