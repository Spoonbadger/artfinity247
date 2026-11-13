"use client";
// "Coming soon — join the waitlist": the email capture shown on /scanning and /studio/scanning while the scanning
// service is off. Saved to ScanWaitlist (POST /api/scanning/waitlist).
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export default function Waitlist({ source, defaultEmail = "", dark = false, className }: { source: "public" | "studio"; defaultEmail?: string; dark?: boolean; className?: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError("Enter an email address like you@example.com."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/scanning/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, source }) });
      if (!res.ok) {
        const p = await problemFrom(res, "We couldn't save that. Try again.");
        setError(p.message);
        failed(p.message, { retry: () => setError(null) });
        return;
      }
      setDone(true);
      saved("You're on the list", { description: "We'll email you when scanning opens." });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-[15px] font-semibold", dark ? "bg-white/10 text-white" : "bg-earned-soft text-ink", className)}>
        <Check className="h-5 w-5 shrink-0 text-earned" aria-hidden="true" />
        You&apos;re on the list. We&apos;ll email {email.trim()} when scanning opens.
      </p>
    );
  }
  return (
    <form id="waitlist" onSubmit={submit} noValidate className={cn("grid max-w-[480px] gap-2", className)}>
      <label htmlFor={`waitlist-${source}`} className={cn("text-[14px] font-semibold", dark ? "text-white" : "text-ink")}>Get an email when it opens</label>
      <div className="flex flex-wrap gap-2">
        <input
          id={`waitlist-${source}`} type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" aria-invalid={!!error} aria-describedby={error ? `waitlist-${source}-err` : undefined}
          className="min-h-[48px] min-w-0 flex-1 rounded-xl border-2 border-ink bg-white px-3 text-[16px] text-ink outline-none focus:border-scan"
        />
        <button type="submit" disabled={busy} className="btn btn-blue min-h-[48px]">
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Join the waitlist
        </button>
      </div>
      {error && <p id={`waitlist-${source}-err`} role="alert" className={cn("text-[13.5px] font-semibold", dark ? "text-[#ffb4a0]" : "text-coral")}>{error}</p>}
    </form>
  );
}
