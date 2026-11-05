"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { failed, problemFrom, saved } from "@/lib/feedback";

/** Paste a list of emails. Only with the consent box ticked; existing rows (and unsubscribes) are left alone. */
export default function FollowerImport({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  // Fix links ("Add followers") land on #add-followers: open the form there.
  useEffect(() => {
    if (window.location.hash === "#add-followers" && ref.current) ref.current.open = true;
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (!text.trim()) return failed("Paste at least one email", { description: "One per line, like ada@example.com. A name after a comma is fine." });
    if (!consent) return failed("Tick the box first", { description: "Only add people who asked to hear from you." });
    setBusy(true);
    try {
      const res = await fetch("/api/studio/followers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, consent }) });
      if (!res.ok) {
        const p = await problemFrom(res, "Import failed.");
        failed(p.message, { fix: p.fix, retry: p.fix || res.status < 500 ? undefined : () => submit() });
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data.added) saved(`Added ${data.added} ${data.added === 1 ? "follower" : "followers"}`, { description: data.skipped ? `${data.skipped} already on your list.` : "They'll get your next newsletter.", next: { label: "Write a newsletter", href: "/studio/newsletter" } });
      else saved("Everyone was already on your list", { description: "Nothing new to add." });
      setText("");
      setConsent(false);
      router.refresh();
    } catch {
      failed("You seem to be offline", { description: "Your list is still in the box. Check your connection and try again.", retry: () => submit() });
    } finally {
      setBusy(false);
    }
  };

  return (
    <details ref={ref} id="add-followers" open={defaultOpen || undefined} className="af-panel group scroll-mt-24 p-4 sm:p-5">
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
          <button type="submit" disabled={busy} className="btn btn-blue btn-sm min-h-[44px] px-5">{busy ? "Adding…" : "Add to my list"}</button>
          {!consent && text.trim() && <span className="ml-3 text-[13px] text-ink-2">Tick the box above to add them.</span>}
        </div>
      </form>
    </details>
  );
}
