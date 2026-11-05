"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Paste a list of emails. Only with the consent box ticked; existing rows (and unsubscribes) are left alone. */
export default function FollowerImport() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/studio/followers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, consent }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Import failed.");
      toast.success(`Added ${data.added}${data.skipped ? `, ${data.skipped} already on your list` : ""}`);
      setText("");
      setConsent(false);
      router.refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="af-panel group p-4 sm:p-5">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
        <span className="grid">
          <b className="text-[17px]">Add followers</b>
          <span className="text-[13.5px] text-ink-2">Bring your list from a market sign-up sheet or another tool.</span>
        </span>
        <span className="btn btn-ghost btn-sm group-open:hidden">Add</span>
      </summary>
      <form onSubmit={submit} className="mt-4 grid gap-3">
        <label className="af-field">
          <span className="label">Emails, one per line (a name after a comma is fine)</span>
          <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"ada@example.com, Ada\nsam@example.com"} className="resize-y font-mono !text-[14px]" />
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-[14.5px]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[rgb(var(--af-scan-rgb))]" />
          <span><b>These people agreed to hear from me.</b> <span className="text-ink-2">Don&apos;t add anyone who didn&apos;t ask. It hurts delivery for every artist.</span></span>
        </label>
        <div>
          <button type="submit" disabled={busy || !consent || !text.trim()} className="btn btn-blue btn-sm min-h-[44px] px-5">{busy ? "Adding…" : "Add to my list"}</button>
        </div>
      </form>
    </details>
  );
}
