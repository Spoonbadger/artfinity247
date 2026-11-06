"use client";
// "Get Infinity" anywhere outside /studio/infinity: one click straight to checkout, never a second "Get Infinity" on
// the plan page. Same calls as BillingPanel: Stripe Checkout (/api/studio/infinity/checkout), or the simulated
// subscription in test mode (/api/studio/infinity/test). Logged out → log in, then /studio/infinity?start=1 resumes
// checkout. Already on Infinity → "You're on Infinity", linking to billing.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PRO } from "@/lib/plans";
import { failed, problemFrom } from "@/lib/feedback";
import { withNext } from "@/components/auth/next";
import { cn } from "@/lib/utils";

type Mode = "live" | "simulated" | "off";
export type InfinityState = { signedIn: boolean; active: boolean; mode: Mode };

/** Where checkout resumes after logging in. */
export const INFINITY_START = "/studio/infinity?start=1";
const PLAN = "/studio/infinity";

// One lookup per page load, shared by every button on the page.
let lookup: Promise<InfinityState> | null = null;
function loadState(): Promise<InfinityState> {
  lookup ??= (async () => {
    const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (!me?.user) return { signedIn: false, active: false, mode: "live" as Mode };
    const r = await fetch("/api/studio/pro", { credentials: "include", cache: "no-store" });
    if (!r.ok) return { signedIn: false, active: false, mode: "live" as Mode };
    const p = (await r.json()) as { active?: boolean; billing?: Mode };
    return { signedIn: true, active: !!p.active, mode: p.billing ?? "live" };
  })().catch((e) => { lookup = null; throw e; });
  return lookup;
}

/** Starts Infinity checkout for the signed-in artist: Stripe in live mode, the simulated flow in test mode. */
export async function startInfinityCheckout(mode: Mode, interval: "month" | "year" = "month"): Promise<boolean> {
  if (mode === "off") {
    window.location.assign(`${PLAN}#billing`);
    return true;
  }
  const simulated = mode === "simulated";
  const r = await fetch(simulated ? "/api/studio/infinity/test" : "/api/studio/infinity/checkout", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(simulated ? { action: "subscribe" } : { interval }),
  });
  if (!r.ok) {
    const p = await problemFrom(r, "Checkout didn't open. Try again in a minute.");
    const fix = r.status === 409 ? { label: "Manage billing", href: `${PLAN}#billing` } : p.fix;
    failed(p.message, { fix, retry: fix ? undefined : () => void startInfinityCheckout(mode, interval) });
    return false;
  }
  const d = (await r.json().catch(() => ({}))) as { url?: string };
  // Stripe sends them back to /studio/infinity?billing=success; the test flow lands on the same screen.
  window.location.assign(d.url || `${PLAN}?billing=success`);
  return true;
}

export default function StartInfinityButton({
  label = `Get ${PRO.name}`, className = "btn btn-blue", activeClassName, icon, included = false, includedClassName, state,
}: {
  label?: ReactNode;
  className?: string;
  /** For "You're on Infinity". Defaults to a ghost button of the same size. */
  activeClassName?: string;
  icon?: ReactNode;
  /** Adds a small "What's included" link to /studio/infinity next to the button. */
  included?: boolean;
  includedClassName?: string;
  /** Known on the server already: skips the lookup. */
  state?: InfinityState;
}) {
  const [known, setKnown] = useState<InfinityState | null>(state ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state) return;
    let live = true;
    loadState().then((s) => { if (live) setKnown(s); }).catch(() => {});
    return () => { live = false; };
  }, [state]);

  async function go() {
    setBusy(true);
    try {
      const s = known ?? (await loadState());
      if (!s.signedIn) { window.location.assign(withNext("/login", INFINITY_START)); return; }
      if (s.active) { window.location.assign(`${PLAN}#billing`); return; }
      if (!(await startInfinityCheckout(s.mode))) setBusy(false);
    } catch {
      setBusy(false);
      failed("Couldn't reach Artfinity. Check your connection.", { retry: () => void go() });
    }
  }

  const link = included && (
    <Link href={PLAN} className={cn("inline-flex min-h-[40px] items-center text-[13.5px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink md:min-h-0", includedClassName)}>
      What&apos;s included
    </Link>
  );

  const control = known?.active ? (
    <Link href={`${PLAN}#billing`} className={activeClassName ?? cn("btn btn-ghost", ["btn-sm", "btn-lg", "w-full"].filter((c) => className.split(" ").includes(c)))} title="Manage billing">
      You&apos;re on {PRO.name}
    </Link>
  ) : (
    <button type="button" onClick={go} disabled={busy} aria-busy={busy} className={className}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : icon}
      {busy ? "Starting…" : label}
    </button>
  );

  if (!link) return control;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2">
      {control}
      {link}
    </span>
  );
}

/** "Update card" / "Manage billing" outside /studio/infinity: straight to Stripe's billing page in one click. */
export function ManageBillingButton({ label = "Manage billing", className = "btn btn-blue btn-sm" }: { label?: ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const r = await fetch("/api/studio/infinity/portal", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      // No Stripe keys here (test mode) or no Stripe customer yet: the plan page has the billing controls.
      if (r.status === 503 || r.status === 404) { window.location.assign(`${PLAN}#billing`); return; }
      if (!r.ok) {
        const p = await problemFrom(r, "Billing didn't open. Try again in a minute.");
        failed(p.message, { fix: p.fix ?? { label: "Open Infinity plan", href: `${PLAN}#billing` } });
        setBusy(false);
        return;
      }
      const d = (await r.json().catch(() => ({}))) as { url?: string };
      window.location.assign(d.url || `${PLAN}#billing`);
    } catch {
      setBusy(false);
      failed("Couldn't reach Artfinity. Check your connection.", { retry: () => void go() });
    }
  }
  return (
    <button type="button" onClick={go} disabled={busy} aria-busy={busy} className={className}>
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {busy ? "Opening…" : label}
    </button>
  );
}
