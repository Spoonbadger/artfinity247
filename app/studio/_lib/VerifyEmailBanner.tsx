"use client";

// Slim "Confirm your email — resend" bar at the top of Studio while the artist's email is unconfirmed, and a
// one-time "Email confirmed" after the link (?verified=1). Studio stays usable; payouts and newsletters wait.
import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function VerifyEmailBanner({ email, verified }: { email: string; verified: boolean }) {
  const flag = useSearchParams().get("verified");
  const path = usePathname();
  // Full bar on the pages it blocks (home, money, newsletter, page settings). Elsewhere it can be put off for
  // this visit, so it isn't repeated on every page.
  const blocks = ["/studio", "/studio/money", "/studio/newsletter", "/studio/followers", "/studio/page"].includes(path);
  const [later, setLater] = useState(false);
  useEffect(() => {
    try { setLater(sessionStorage.getItem("af-confirm-later") === "1"); } catch { /* storage blocked: keep showing it */ }
  }, []);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  // Fix links elsewhere ("Resend confirmation", lib/feedback.ts) point at /studio#confirm-email: put focus on Resend.
  const resendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!verified && window.location.hash === "#confirm-email") resendRef.current?.focus();
  }, [verified]);

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

  if (!blocks && later && flag !== "expired") return null;

  async function resend() {
    setState("sending");
    try {
      const r = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return setState("sent");
      setError(d.code === "rate_limited" ? "Sent a few already. Check spam, or try again in an hour." : d.error || "Couldn't send it. Try again.");
      setState("error");
    } catch {
      setError("Couldn't send it. Try again.");
      setState("error");
    }
  }

  return (
    <Wrap>
      <div id="confirm-email" role="status" className="flex scroll-mt-4 flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] border-[1.5px] border-ink bg-sticker/40 px-4 py-2 text-[14px]">
        <b>{flag === "expired" ? "That link expired." : "Confirm your email"}</b>
        <span className="min-w-0 flex-1 text-ink-2 max-sm:order-last max-sm:basis-full">
          {state === "sent" ? `Sent. Check ${email} (and spam). The link works for 7 days.` : state === "error" ? error : <>Tap the link we sent to {email}. Payouts and newsletters wait until then. <a href="/studio/page#account-details" className="underline underline-offset-2">Wrong email?</a></>}
        </span>
        {state !== "sent" && (
          <button ref={resendRef} type="button" onClick={resend} disabled={state === "sending"} className="inline-flex min-h-[36px] items-center gap-1.5 font-semibold text-scan underline underline-offset-4">
            {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {flag === "expired" ? "Send a new link" : "Resend"}
          </button>
        )}
        {!blocks && (
          <button type="button" onClick={() => { setLater(true); try { sessionStorage.setItem("af-confirm-later", "1"); } catch { /* ignore */ } }} className="min-h-[36px] font-semibold text-ink-2 underline underline-offset-4">
            Later
          </button>
        )}
      </div>
    </Wrap>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1320px] px-4 pt-4 sm:px-6 lg:px-10 lg:pt-6">{children}</div>;
}
