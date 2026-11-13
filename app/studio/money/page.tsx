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
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money" };

const pct = (n: number) => `${Math.round(n * 100)}%`;
const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

type Notice = { ok: boolean; text: string; fix?: { label: string; href: string } };

const STRIPE_NOTICE: Record<string, Notice> = {
  ready: { ok: true, text: "Stripe is connected. Your payouts now go to your bank." },
  // "pending" is shown by the Connect card itself (reason and Finish setup button).
  simulated: { ok: true, text: "Connected a test Stripe account. Stripe isn't set up here, so no money moves." },
  "simulated-dashboard": { ok: false, text: "This is a test account, so there's no Stripe dashboard to open.", fix: { label: "How payouts work", href: "/help/getting-paid/how-payouts-reach-you" } },
  off: { ok: false, text: "Stripe payouts aren't switched on here yet. Your earnings are safe.", fix: { label: "How payouts work", href: "/help/getting-paid/how-payouts-reach-you" } },
  error: { ok: false, text: "Stripe didn't open. Try again in a minute.", fix: { label: "Try again", href: "#getpaid-h" } },
};

export default async function MoneyPage({ searchParams }: { searchParams: { stripe?: string } }) {
  const artist = await requireArtist("/studio/money");
  const [b, acct] = await Promise.all([
    getBalance(artist.id),
    prisma.artist.findUnique({ where: { id: artist.id }, select: { proUntil: true, emailVerifiedAt: true, _count: { select: { artworks: true } } } }),
  ]);
  const verified = !!acct?.emailVerifiedAt;
  // Only asks Stripe while payouts are connected but not on yet.
  const payoutDetail = b.stripeStatus === "pending" ? await connectDetail(artist.id) : null;
  const hasArt = (acct?._count.artworks ?? 0) > 0;
  const pro = isProActive(acct);
  const notice = searchParams.stripe && searchParams.stripe !== "unverified" ? STRIPE_NOTICE[searchParams.stripe] : undefined;
  // Payouts are Stripe-only: until the account is payout-ready, money is held and the Connect card leads the page.
  const viaStripe = b.payoutVia === "stripe";
  const getPaid = (
    <GetPaidCard status={b.stripeStatus} mode={connectMode()} nextDate={dayUTC(b.nextPayout.date)} payoutDay={ordinal(PAYOUT_DAY_OF_MONTH)} heldCents={b.heldCents} verified={verified} email={artist.email} detail={payoutDetail} />
  );
  const lateNames = b.lateMonths.map((m) => monthLabel(m).split(" ")[0]);
  const lateText = lateNames.length > 1 ? `${lateNames.slice(0, -1).join(", ")} and ${lateNames[lateNames.length - 1]} payouts are` : `${lateNames[0]} payout is`;

  const how = [
    {
      text: pro
        ? <>You keep <b>{pct(PRO.split)}</b> of each sale&apos;s profit on {PRO.name}. Sales from before your plan keep the split they were made at.</>
        : <>You keep <b>{pct(FREE_SPLIT)}</b> of each sale&apos;s profit. <b>{pct(PRO.split)}</b> on the {PRO.name} plan.</>,
    },
    { text: <>Each month&apos;s sales are paid together, by the <b>{ordinal(PAYOUT_DAY_OF_MONTH)}</b> of the next month, to your bank via Stripe.</> },
    ...(viaStripe ? [] : [{ text: <>Until Stripe is connected, your earnings are held here. The next run on the {ordinal(PAYOUT_DAY_OF_MONTH)} pays every month that&apos;s waiting.</> }]),
    { text: <>Each sale clears after a <b>{RETURN_WINDOW_DAYS}-day</b> return window. Late-month sales still in it are paid on time.</> },
    { text: <>Bulk orders of your own prints don&apos;t count.</> },
  ];

  return (
    <StudioPage
      title="Money"
      actions={<><HelpLink href="/help/getting-paid/when-paid" label="How payouts work" /><Link href="/studio/sales" className="btn btn-ghost">Sales</Link></>}
    >
      {b.lateMonths.length > 0 && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-coral bg-[#fff1ed] px-4 py-3 text-[15px]">
          <b className="min-w-0 flex-1">Your {lateText} late. We&apos;re on it.</b>
          <Link href="/help/getting-paid/payout-late" className="t-small font-semibold underline underline-offset-2">Why payouts run late</Link>
          <Link href="/contact" className="btn btn-sm border-coral bg-coral text-white">Message us</Link>
        </div>
      )}

      {notice && <Problem tone={notice.ok ? "success" : "error"} title={notice.text} fix={notice.fix} />}

      {/* Payout details wait for a confirmed email (lib/emailVerify.ts): say so up front, with the fix. */}
      {/* The "Confirm your email" bar at the top of every Studio page covers the usual case; this is for the Stripe bounce. */}
      {!verified && searchParams.stripe === "unverified" && (
        <ConfirmEmailProblem email={artist.email} tone="error">
          Stripe opens once your email is confirmed. Click the link we sent to <b>{artist.email}</b>, then come back.
        </ConfirmEmailProblem>
      )}

      {/* Not payout-ready: one Connect card first, with what's held. It's the only way to get paid. */}
      {!viaStripe && getPaid}

      <BalanceCard b={b} />

      {b.ledger.length === 0 && (
        <EmptyState
          title="No sales yet"
          body={<>Each sale clears after {RETURN_WINDOW_DAYS} days, then it&apos;s paid by the {ordinal(PAYOUT_DAY_OF_MONTH)} of the next month.</>}
          action={hasArt ? { label: "Print a QR code", href: "/studio/qr" } : { label: "Add your first piece", href: "/studio/art/new" }}
          secondary={hasArt ? { label: "Share your page", href: "/studio/share" } : undefined}
        />
      )}

      {viaStripe ? (
        <div className={b.payouts.length ? "grid items-start gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]" : "grid items-start gap-4 lg:grid-cols-2"}>
          {b.payouts.length > 0 && <PayoutsList payouts={b.payouts} ledger={b.ledger} adjustments={b.adjustments} lateMonths={b.lateMonths} />}
          {getPaid}
        </div>
      ) : (
        b.payouts.length > 0 && <PayoutsList payouts={b.payouts} ledger={b.ledger} adjustments={b.adjustments} lateMonths={b.lateMonths} held payoutDay={ordinal(PAYOUT_DAY_OF_MONTH)} />
      )}

      {(b.ledger.length > 0 || b.adjustments.length > 0) && <Ledger ledger={b.ledger} adjustments={b.adjustments} currentMonth={b.currentMonth} />}

      {b.ledger.length > 0 && (
        <Disclosure title="Earnings" hint="Charts, best pieces, sources">
          <MoneyInsights ledger={b.ledger} nowIso={b.now} />
        </Disclosure>
      )}

      <Disclosure title="How payouts work" hint={<>{pct(pro ? PRO.split : FREE_SPLIT)} of profit · paid by the {ordinal(PAYOUT_DAY_OF_MONTH)}</>}>
        <ul className="t-body grid max-w-[68ch] list-disc gap-2 pl-5 marker:text-ink-2">
          {how.map((h, i) => <li key={i}>{h.text}</li>)}
        </ul>
      </Disclosure>
    </StudioPage>
  );
}
