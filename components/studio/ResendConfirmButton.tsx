"use client";

// [Resend confirmation] for anything that waits on a confirmed email (Stripe payout setup, newsletters).
// Same endpoint as the Studio banner (app/studio/_lib/VerifyEmailBanner.tsx); feedback by toast.
import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { failed, problemFrom, saved } from "@/lib/feedback";
import { Problem } from "@/components/studio/Problem";
import { cn } from "@/lib/utils";

function useResend(email?: string) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't send the link. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : resend });
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (d.verified) {
        saved("Your email is already confirmed", { description: "Refresh the page to carry on." });
        return;
      }
      setSent(true);
      saved("Confirmation sent", { description: `Check ${email || "your inbox"} (and spam). Click the link, then come back here.` });
    } catch {
      failed("You seem to be offline", { description: "Check your connection and try again.", retry: resend });
    } finally {
      setBusy(false);
    }
  }
  return { busy, sent, resend };
}

export default function ResendConfirmButton({ email, className, label = "Resend confirmation" }: { email?: string; className?: string; label?: string }) {
  const { busy, sent, resend } = useResend(email);
  return (
    <button type="button" onClick={resend} disabled={busy} className={cn("btn btn-sm shrink-0", className)}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {sent ? "Sent — send again" : label}
    </button>
  );
}

/** "Confirm your email first" notice with the [Resend confirmation] fix, for server pages. */
export function ConfirmEmailProblem({ email, title = "Confirm your email to get paid", tone = "warning", children }: { email?: string; title?: string; tone?: "warning" | "error"; children?: ReactNode }) {
  const { busy, sent, resend } = useResend(email);
  return (
    <Problem tone={tone} title={title} fix={{ label: busy ? "Sending…" : sent ? "Sent — send again" : "Resend confirmation", onClick: () => { if (!busy) resend(); } }}>
      {children ?? <>We only pay out to confirmed accounts. Click the link we sent{email ? <> to <b>{email}</b></> : null}, then come back here.</>}
    </Problem>
  );
}
