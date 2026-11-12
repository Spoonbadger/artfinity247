// "How you get paid": artists are paid only through Stripe Connect (Express), straight to their bank
// (lib/stripeConnect.ts, lib/payouts.ts). Until their account is payout-ready, this is the one big card at the top
// of Money: what's held, and one button to Stripe. Once ready, it's a small card with "Manage in Stripe".
// Plain forms, so it works without JavaScript.
import Link from "next/link";
import type { ConnectDetail, ConnectMode, ConnectStatus } from "@/lib/stripeConnect";
import { usd } from "./format";

const CHIP: Record<ConnectStatus, { label: string; cls: string }> = {
  not_connected: { label: "Not connected", cls: "bg-wall text-ink-2" },
  pending: { label: "Finish setup", cls: "bg-sticker text-ink" },
  ready: { label: "Ready", cls: "bg-earned-soft text-earned" },
};

const Tick = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function GetPaidCard({ status, mode, nextDate, payoutDay, heldCents = 0, verified = true, email, detail = null }: {
  status: ConnectStatus; mode: ConnectMode; nextDate: string;
  /** "5th": the monthly payout day (lib/payoutPlan.ts). */
  payoutDay: string;
  /** Closed, unpaid months waiting for Stripe (Balance.heldCents). */
  heldCents?: number;
  verified?: boolean; email?: string;
  /** Why it's not ready yet (lib/stripeConnect.ts connectDetail): unfinished setup, payouts paused, or under review. */
  detail?: ConnectDetail | null;
}) {
  const chip = status === "pending" && detail?.state === "paused" ? { label: "Paused", cls: "bg-coral/15 text-coral" } : status === "pending" && detail?.state === "review" ? { label: "In review", cls: "bg-wall text-ink-2" } : CHIP[status];

  if (status === "ready") {
    return (
      <section aria-labelledby="getpaid-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="getpaid-h" className="t-card">How you get paid</h2>
          <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-bold ${chip.cls}`}><Tick />{chip.label}</span>
        </div>
        <p className="text-[15px]">Straight to your bank via Stripe. Next one: <b>{nextDate}</b>.</p>
        {mode !== "off" && (
          <form method="post" action="/api/studio/stripe/dashboard">
            <button type="submit" className="btn btn-ghost btn-sm">Manage in Stripe</button>
          </form>
        )}
        {mode === "simulated" && <p className="text-[13px] text-ink-2"><b className="text-ink">Stripe isn&apos;t set up here.</b> This is a test account. No money moves.</p>}
      </section>
    );
  }

  // Not payout-ready: the one thing to do on this page.
  const title = status === "pending"
    ? detail?.state === "review" ? "Stripe is reviewing your account" : detail?.state === "paused" ? "Bank payouts are paused" : "Finish your Stripe setup"
    : "Connect Stripe to get paid";
  return (
    <section aria-labelledby="getpaid-h" className="af-card grid gap-3 border-scan/40 p-4 sm:p-6" role={detail?.state === "paused" ? "alert" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h2 id="getpaid-h" className="t-card">{title}</h2>
        <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[13px] font-bold ${chip.cls}`}>{chip.label}</span>
      </div>

      <div className="grid gap-1 text-[15px]">
        {heldCents > 0 ? (
          <p><b className="num text-earned">{usd(heldCents)}</b> is held for you. Paid by the {payoutDay} once you&apos;re connected.</p>
        ) : (
          <p>We pay through Stripe, straight to your bank. Paid by the {payoutDay} once you&apos;re connected.</p>
        )}
        {status === "pending" && detail?.reason && <p className="t-small">{detail.reason}</p>}
        {status === "not_connected" && mode !== "off" && <p className="t-small">About 5 minutes. Stripe asks for your bank, ID and tax details.</p>}
      </div>

      {!verified && (
        <p className="rounded-[4px] bg-sticker/30 px-3 py-2.5 text-[13.5px]">
          <b>Confirm your email first.</b> Check {email || "your inbox"} for our link.{" "}
          <a href="#confirm-email" className="font-semibold underline underline-offset-2">Resend it</a>
        </p>
      )}

      {mode === "off" ? (
        <p className="rounded-[4px] bg-wall px-3 py-2 text-[13.5px] text-ink-2">Stripe payouts aren&apos;t switched on here yet. Your earnings are safe.</p>
      ) : detail?.state === "review" ? (
        detail.reason.startsWith("Stripe couldn't") ? <Link href="/contact" className="btn btn-ghost w-fit">Message us</Link> : null
      ) : (
        <form method="post" action="/api/studio/stripe/connect" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="submit" className="btn btn-blue">{status === "pending" ? "Finish setup" : "Connect with Stripe"}</button>
          <Link href="/help/getting-paid/how-payouts-reach-you" className="t-small font-semibold underline underline-offset-2">What Stripe asks for</Link>
        </form>
      )}
      {mode === "simulated" && (
        <p className="text-[13px] text-ink-2"><b className="text-ink">Stripe isn&apos;t set up here.</b> Connecting makes a test account. No money moves.</p>
      )}
    </section>
  );
}
