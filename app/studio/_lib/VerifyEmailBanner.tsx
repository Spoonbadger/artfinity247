"use client";

// Slim "Confirm your email — resend" bar at the top of Studio while the artist's email is unconfirmed, and a
// one-time "Email confirmed" after the link (?verified=1). Studio stays usable; payouts and newsletters wait.
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function VerifyEmailBanner({ email, verified }: { email: string; verified: boolean }) {
  const flag = useSearchParams().get("verified");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  if (verified) {
    if (flag !== "1") return null;
    return (
      <Wrap>
        <div role="status" className="rounded-[4px] border-[1.5px] border-earned bg-earned-soft px-4 py-2 text-[14px] font-semibold">
          Email confirmed. Payouts and newsletters are unlocked.
        </div>
      </Wrap>
    );
  }

  async function resend() {
    setState("sending");
    try {
      const r = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return setState("sent");
      setError(d.code === "rate_limited" ? "Sent a few already. Check spam, or try again in an hour." : "Couldn't send it. Try again.");
      setState("error");
    } catch {
      setError("Couldn't send it. Try again.");
      setState("error");
    }
  }

  return (
    <Wrap>
      <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] border-[1.5px] border-ink bg-sticker/40 px-4 py-2 text-[14px]">
        <b>{flag === "expired" ? "That link expired." : "Confirm your email"}</b>
        <span className="min-w-0 flex-1 text-ink-2">
          {state === "sent" ? `Sent. Check ${email}.` : state === "error" ? error : <>We sent a link to {email}. Payouts and newsletters unlock once you click it.</>}
        </span>
        {state !== "sent" && (
          <button type="button" onClick={resend} disabled={state === "sending"} className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-scan underline underline-offset-4">
            {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {flag === "expired" ? "Send a new link" : "Resend"}
          </button>
        )}
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1320px] px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6">{children}</div>;
}
