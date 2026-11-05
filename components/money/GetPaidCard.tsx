// "Get paid automatically": connect a Stripe Express account so payouts go to the artist's bank (lib/stripeConnect.ts).
// Venmo stays as the fallback for anyone who doesn't connect. Plain forms, so it works without JavaScript.
import Link from "next/link";
import type { ConnectMode, ConnectStatus } from "@/lib/stripeConnect";

const CHIP: Record<ConnectStatus, { label: string; cls: string }> = {
  not_connected: { label: "Not connected", cls: "bg-wall text-ink-2" },
  pending: { label: "Finish setup", cls: "bg-sticker text-ink" },
  ready: { label: "Ready", cls: "bg-earned-soft text-earned" },
};

export default function GetPaidCard({ status, mode, venmoHandle, nextDate }: { status: ConnectStatus; mode: ConnectMode; venmoHandle: string | null; nextDate: string }) {
  const chip = CHIP[status];
  const handle = venmoHandle ? `@${venmoHandle.replace(/^@/, "")}` : null;
  return (
    <section aria-labelledby="getpaid-h" className="af-card grid content-start gap-3 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="getpaid-h" className="text-[20px] font-bold leading-tight">Get paid automatically</h2>
        <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] font-bold ${chip.cls}`}>
          {status === "ready" && <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><path d="M2 6.5l2.5 2.5L10 3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          {chip.label}
        </span>
      </div>

      <p className="text-[14.5px]">
        {status === "ready"
          ? <>Payouts go to your bank via Stripe. Next one: <b>{nextDate}</b>.</>
          : status === "pending"
            ? <>Stripe needs a few more details before it can pay you. Until then, we pay by Venmo.</>
            : <>Connect Stripe and each month&apos;s payout lands in your bank. Takes about 5 minutes: your name, bank and tax details.</>}
      </p>

      {mode === "off" ? (
        <p className="rounded-[4px] bg-wall px-3 py-2 text-[13px] text-ink-2">Stripe isn&apos;t set up here yet. We&apos;ll keep paying you by Venmo.</p>
      ) : (
        <>
          {status === "ready" ? (
            <form method="post" action="/api/studio/stripe/dashboard">
              <button type="submit" className="btn btn-ghost btn-sm">Manage in Stripe</button>
            </form>
          ) : (
            <form method="post" action="/api/studio/stripe/connect">
              <button type="submit" className="btn btn-blue">{status === "pending" ? "Finish setup" : "Connect with Stripe"}</button>
            </form>
          )}
          {mode === "simulated" && (
            <p className="text-[12.5px] text-ink-2"><b className="text-ink">Stripe isn&apos;t set up here.</b> {status === "ready" ? "This is a test account." : "Connecting makes a test account."} No money moves.</p>
          )}
        </>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-[13.5px]">
        <span className="text-ink-2">
          {status === "ready" ? "Backup" : "Or get paid by Venmo"}:{" "}
          {handle ? <b className="text-ink">{handle}</b> : <span className="font-semibold text-coral">no handle yet</span>}
        </span>
        <Link href="/studio/page" className="font-semibold text-ink-2 underline underline-offset-2">{handle ? "Change" : "Add Venmo"}</Link>
      </div>
    </section>
  );
}
