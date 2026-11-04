"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Dev-only Pro trial (no billing yet). In production this renders "Billing coming soon". */
export default function TrialButton({ devTrial, active, onDark = false }: { devTrial: boolean; active: boolean; onDark?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!devTrial) {
    return <span className="btn btn-ghost cursor-default opacity-80" aria-disabled="true">Billing coming soon</span>;
  }

  async function run(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/studio/pro/trial", { method, credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setError(d.error || "Something went wrong.");
      else router.refresh();
    } catch {
      setError("Couldn't reach Artfinity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid justify-items-start gap-2">
      {active ? (
        <button type="button" className={`btn btn-ghost btn-sm ${onDark ? "!border-white !text-white hover:!bg-white hover:!text-ink" : ""}`} disabled={busy} onClick={() => run("DELETE")}>
          End Pro now
        </button>
      ) : (
        <button type="button" className="btn btn-blue btn-lg" disabled={busy} onClick={() => run("POST")}>
          {busy ? "Starting…" : "Start 14-day trial"}
        </button>
      )}
      <span className={`text-[12.5px] ${onDark ? "text-white/70" : "text-ink-2"}`}>Test mode only. No card, no billing yet.</span>
      {error && <span role="alert" className={`text-[13px] font-semibold ${onDark ? "text-sticker" : "text-coral"}`}>{error}</span>}
    </div>
  );
}
