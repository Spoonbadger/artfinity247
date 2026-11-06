import Link from "next/link";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import BalanceCard from "@/components/money/BalanceCard";
import MoneyInsights from "@/components/money/MoneyInsights";
import PayoutsList from "@/components/money/PayoutsList";
import Ledger from "@/components/money/Ledger";
import GetPaidCard from "@/components/money/GetPaidCard";
import Disclosure from "@/components/money/Disclosure";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import { ConfirmEmailProblem } from "@/components/studio/ResendConfirmButton";
import { dayUTC } from "@/components/money/format";
import { connectDetail, connectMode } from "@/lib/stripeConnect";
import { getBalance, monthLabel, PAYOUT_DAY_OF_MONTH, RETURN_WINDOW_DAYS } from "@/lib/balance";
import { FREE_SPLIT, PRO, isProActive } from "@/lib/plans";
import { prisma } from "@/lib/prisma";
import { VENMO_CONFIRM_HOURS } from "@/lib/venmo";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

type Notice = { ok: boolean; text: string; fix?: { label: string; href: string } };
const VENMO_FIX = { label: "Change Venmo", href: "/studio/page#venmo" };

const VENMO_NOTICE: Record<string, Notice> = {
  confirmed: { ok: true, text: "Venmo updated. Payouts now go to your new handle." },
  expired: { ok: false, text: `That confirm link expired (links last ${VENMO_CONFIRM_HOURS} hours). Change your Venmo again to get a new one.`, fix: VENMO_FIX },
  invalid: { ok: false, text: "That confirm link didn't work. It may have been used already. Your Venmo hasn't changed.", fix: VENMO_FIX },
  taken: { ok: false, text: "That Venmo handle is already on another Artfinity account, so we didn't switch. Message us if it's yours.", fix: { label: "Message us", href: "/contact" } },
};

const STRIPE_NOTICE: Record<string, Notice> = {
  ready: { ok: true, text: "Stripe is connected. Your payouts now go to your bank." },
  // "pending" is shown by the payout-state notice below, which carries the Finish setup button itself.
  simulated: { ok: true, text: "Connected a test Stripe account. Stripe isn't set up here, so no money moves." },
  "simulated-dashboard": { ok: false, text: "This is a test account, so there's no Stripe dashboard to open.", fix: { label: "How payouts work", href: "/help/getting-paid/how-payouts-reach-you" } },
  off: { ok: false, text: "Stripe isn't set up here yet. We'll keep paying you by Venmo.", fix: { label: "Add Venmo", href: "/studio/page#venmo" } },
  error: { ok: false, text: "Stripe didn't open. Try again in a minute.", fix: { label: "Try again", href: "#getpaid-h" } },
};

export default async function MoneyPage({ searchParams }: { searchParams: { venmo?: string; stripe?: string } }) {
  const artist = await requireArtist("/studio/money");
  const [b, acct] = await Promise.all([
    getBalance(artist.id),
    prisma.artist.findUnique({ where: { id: artist.id }, select: { proUntil: true, venmoPending: true, venmoPendingAt: true, emailVerifiedAt: true, _count: { select: { artworks: true } } } }),
  ]);
  const verified = !!acct?.emailVerifiedAt;
  // Only asks Stripe while payouts are connected but not on yet.
  const payoutDetail = b.stripeStatus === "pending" ? await connectDetail(artist.id) : null;
  const hasArt = (acct?._count.artworks ?? 0) > 0;
  const pro = isProActive(acct);
  const pendingLive = acct?.venmoPendingAt && Date.now() - acct.venmoPendingAt.getTime() < VENMO_CONFIRM_HOURS * 3_600_000;
  const venmoPending = pendingLive ? acct?.venmoPending ?? null : null;
  const venmoNotice = searchParams.venmo ? VENMO_NOTICE[searchParams.venmo] : searchParams.stripe && searchParams.stripe !== "unverified" ? STRIPE_NOTICE[searchParams.stripe] : undefined;
  const viaStripe = b.payoutVia === "stripe";
  const noPayoutMethod = !b.venmoHandle && !viaStripe;
  const lateNames = b.lateMonths.map((m) => monthLabel(m).split(" ")[0]);
  const lateText = lateNames.length > 1 ? `${lateNames.slice(0, -1).join(", ")} and ${lateNames[lateNames.length - 1]} payouts are` : `${lateNames[0]} payout is`;

  const how = [
    {
      dab: "#0f7a55",
      text: pro
        ? <>You keep <b>{pct(PRO.split)}</b> of each sale&apos;s profit on {PRO.name}. Sales from before your plan keep the split they were made at.</>
        : <>You keep <b>{pct(FREE_SPLIT)}</b> of each sale&apos;s profit. <b>{pct(PRO.split)}</b> on the {PRO.name} plan.</>,
    },
    { dab: "#a9d8c1", text: <>Sales clear after a <b>{RETURN_WINDOW_DAYS}-day</b> return window.</> },
    { dab: "#3d9f76", text: <>Each month is paid by the <b>{ordinal(PAYOUT_DAY_OF_MONTH)}</b> of the next, {viaStripe ? "to your bank via Stripe" : "to your Venmo"}.</> },
    { dab: "#15161b", text: <>Bulk orders of your own prints don&apos;t count.</> },
  ];

  return (
    <StudioPage
      title="Money"
      actions={<><HelpLink href="/help/getting-paid/when-paid" label="How payouts work" /><Link href="/studio/sales" className="btn btn-ghost">Sales</Link></>}
    >
      {b.lateMonths.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[4px] border-2 border-coral bg-[#fff1ed] px-4 py-3 text-[14.5px]">
          <i className="paint-dab h-3.5 w-3.5" style={{ ["--dab" as string]: "var(--af-coral)" }} aria-hidden="true" />
          <b className="min-w-0 flex-1">Your {lateText} late. We&apos;re on it — or message us.</b>
          <Link href="/help/getting-paid/payout-late" className="text-[13.5px] font-semibold text-ink-2 underline underline-offset-2">Why payouts run late</Link>
          <Link href="/contact" className="btn btn-sm border-coral bg-coral text-white">Message us</Link>
        </div>
      )}

      {venmoNotice && <Problem tone={venmoNotice.ok ? "success" : "error"} title={venmoNotice.text} fix={venmoNotice.fix} />}

      {/* Payouts set up but not on (back from Stripe unfinished, or paused later): the reason and the fix, one click to Stripe. */}
      {payoutDetail && (payoutDetail.state !== "setup" || searchParams.stripe === "pending") ? (
        <div role={payoutDetail.state === "paused" ? "alert" : "status"} className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3 ${payoutDetail.state === "paused" ? "border-coral/50 bg-coral/10" : "border-sticker bg-sticker/20"}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold">{payoutDetail.state === "review" ? "Stripe is reviewing your account" : payoutDetail.state === "paused" ? "Bank payouts are paused" : "Almost there"}</p>
            <p className="text-[13.5px] text-ink-2">{payoutDetail.reason} We pay by Venmo until then.</p>
          </div>
          {payoutDetail.state === "review" ? (
            payoutDetail.reason.startsWith("Stripe couldn't") && <Link href="/contact" className="btn btn-sm shrink-0">Message us</Link>
          ) : (
            <form method="post" action="/api/studio/stripe/connect"><button type="submit" className="btn btn-sm shrink-0">Finish setup</button></form>
          )}
        </div>
      ) : null}

      {/* Payout details wait for a confirmed email (lib/emailVerify.ts): say so up front, with the fix. */}
      {/* The "Confirm your email" bar at the top of every Studio page covers the usual case; this is for the Stripe bounce. */}
      {!verified && searchParams.stripe === "unverified" && (
        <ConfirmEmailProblem email={artist.email} tone="error">
          Stripe opens once your email is confirmed. Click the link we sent to <b>{artist.email}</b>, then come back.
        </ConfirmEmailProblem>
      )}

      {venmoPending !== null && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] border-[1.5px] border-sticker bg-sticker/30 px-4 py-3 text-[14.5px]">
          <b className="min-w-0 flex-1">Waiting for you to confirm by email: {venmoPending || "remove your Venmo"}</b>
          <Link href="/studio/page#venmo" className="text-[13.5px] font-semibold text-ink-2 underline underline-offset-2">Change or cancel</Link>
        </div>
      )}

      {/* Money is waiting with nowhere to go: that's a blocker. With $0 the balance card's "Add Venmo" is enough. */}
      {noPayoutMethod && verified && b.lifetimeCents > 0 && (
        <Problem title="Add a way to get paid" fix={{ label: "Add Venmo", href: "/studio/page#venmo" }}>
          Your earnings are safe until you do. Or connect Stripe below.
        </Problem>
      )}

      <BalanceCard b={b} />

      {b.ledger.length === 0 && (
        <EmptyState
          title="No sales yet"
          body={<>Each sale clears after {RETURN_WINDOW_DAYS} days, then it&apos;s paid by the {ordinal(PAYOUT_DAY_OF_MONTH)} of the next month.</>}
          action={hasArt ? { label: "Print a QR code", href: "/studio/qr" } : { label: "Add your first piece", href: "/studio/art/new" }}
          secondary={hasArt ? { label: "Share your page", href: "/studio/share" } : undefined}
        />
      )}

      <div className={b.payouts.length ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]" : "grid items-start gap-4 lg:grid-cols-2"}>
        {b.payouts.length > 0 && <PayoutsList payouts={b.payouts} ledger={b.ledger} adjustments={b.adjustments} lateMonths={b.lateMonths} />}
        <GetPaidCard status={b.stripeStatus} mode={connectMode()} venmoHandle={b.venmoHandle} nextDate={dayUTC(b.nextPayout.date)} verified={verified} email={artist.email} detail={payoutDetail} />
      </div>

      {(b.ledger.length > 0 || b.adjustments.length > 0) && <Ledger ledger={b.ledger} adjustments={b.adjustments} currentMonth={b.currentMonth} />}

      {b.ledger.length > 0 && (
        <Disclosure title="Earnings" hint="Charts, best pieces, sources">
          <MoneyInsights ledger={b.ledger} nowIso={b.now} />
        </Disclosure>
      )}

      <Disclosure title="How payouts work" hint={<>{pct(pro ? PRO.split : FREE_SPLIT)} of profit · paid by the {ordinal(PAYOUT_DAY_OF_MONTH)}</>}>
        <ul className="grid gap-2.5 text-[14.5px]">
          {how.map((h, i) => (
            <li key={i} className="grid grid-cols-[14px_minmax(0,1fr)] items-start gap-2.5">
              <i className="paint-dab mt-1 h-3 w-3" style={{ ["--dab" as string]: h.dab }} />
              <span>{h.text}</span>
            </li>
          ))}
        </ul>
      </Disclosure>
    </StudioPage>
  );
}
