import Link from "next/link";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Brushed, BrushStroke } from "@/components/af/Brush";
import QRCode from "@/components/af/QRCode";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import BillingPanel from "@/components/pro/BillingPanel";
import ReferralShare from "@/components/pro/ReferralShare";
import ProCalculator from "@/components/pro/ProCalculator";
import Disclosure from "@/components/money/Disclosure";
import { getArtistPlan } from "@/components/pro/plan.server";
import { BILLING, FREE_SPLIT, PRO, REFERRALS, dollars, formatPlanDate, pct, planFeatures, proPrice } from "@/lib/plans";
import { ensureReferralCode, getReferrals, referralLink, type ReferralRow, type ReferralStatus } from "@/lib/referrals";
import { confirmCheckout, getBillingSummary } from "@/lib/billing";
import { paysForItself, type BillingView } from "@/lib/billingStatus";
import { calcItemProfitCents } from "@/lib/revenue";
import { money } from "@/lib/earnings";
import { requireArtist, getSales } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Infinity plan" };

const DAY = 86400000;

const DAB: Record<ReferralStatus, string> = {
  joined: "#c9ccff",
  live: "#9aa0ff",
  held: "#2b37f0",
  capped: "#e8a33b",
  blocked: "#b9bcc4",
  rewarded: "#0f7a55",
};
const shortDay = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Honest, plain status for one referred artist (rules in lib/referrals.ts). */
function statusText(r: ReferralRow): { label: string; note?: string } {
  switch (r.status) {
    case "joined": return { label: `Joined · waiting for ${r.firstName}'s first piece` };
    case "live": return { label: "Piece live · waiting for a printed code or a sale" };
    case "held": return { label: `Unlocks ${shortDay(r.unlockAt!)}`, note: `${REFERRALS.holdDays}-day hold after they qualify` };
    case "capped":
      return r.capReason === "month"
        ? { label: `Unlocks ${shortDay(r.unlockAt!)}`, note: `${REFERRALS.maxPerMonth} rewards a month max` }
        : r.capReason === "banked"
          ? { label: "Waiting for room", note: `You have ${REFERRALS.maxBankedMonths} months banked` }
          : { label: "Unlocking now" };
    case "blocked": return { label: "Not eligible", note: "Looks like the same person as you" };
    case "rewarded": return { label: "Rewarded", note: r.rewardedAt ? `+${REFERRALS.rewardMonths} months on ${shortDay(r.rewardedAt)}` : undefined };
  }
}

/** The big status line and the line under it, for each billing state. */
function planStatus(v: BillingView, daysLeft: number): { head: string; line: string; sub?: string } {
  const left = `${daysLeft} ${daysLeft === 1 ? "day" : "days"} left`;
  switch (v.kind) {
    case "free": return { head: "Free", line: `You keep ${pct(FREE_SPLIT)} of profit. Everything core is free.` };
    case "earned": return { head: PRO.name, line: `${PRO.name} until ${formatPlanDate(v.until)} · ${left}`, sub: "Free months from referrals. No card on file." };
    case "renews": return { head: PRO.name, line: `${PRO.name} until ${formatPlanDate(v.renewsOn)} (renews)`, sub: v.interval === "year" ? `${dollars(PRO.yearlyMonthlyCents * 12)} a year, billed yearly.` : `${proPrice()} a month.` };
    case "trial": return { head: PRO.name, line: `${PRO.name} until ${formatPlanDate(v.until)} · ${left}`, sub: `Your free months run first. Billing starts ${formatPlanDate(v.billingStarts)}.` };
    case "cancels": return { head: PRO.name, line: `Cancels on ${formatPlanDate(v.cancelsOn)}`, sub: `You keep ${PRO.name} until ${formatPlanDate(v.until)}, then you're on Free. No more charges.` };
    case "payment_failed": return { head: "Payment failed", line: v.until ? `${PRO.name} stays on until ${formatPlanDate(v.until)} while we retry.` : "Your last payment didn't go through.", sub: "Update your card to keep it going." };
  }
}

export default async function ProPage({ searchParams }: { searchParams?: { billing?: string; session_id?: string; start?: string } }) {
  const artist = await requireArtist("/studio/infinity");
  const now = new Date();
  // Back from Stripe Checkout: turn Infinity on now rather than waiting for the webhook.
  if (searchParams?.billing === "success" && searchParams.session_id) await confirmCheckout(artist.id, searchParams.session_id);
  // Referrals first: getting them settles any months that came due, so the plan below is current.
  const referrals = await getReferrals(artist.id);
  const [plan, code, sales] = await Promise.all([
    getArtistPlan(artist.id),
    ensureReferralCode(artist.id),
    getSales(artist.id, new Date(now.getTime() - 30 * DAY)),
  ]);
  const billing = await getBillingSummary(artist.id, plan.proUntil, now);
  const view = billing.view;
  const link = referralLink(code);
  const rewarded = referrals.filter((r) => r.status === "rewarded").length;
  const daysLeft = plan.active && plan.proUntil ? Math.ceil((plan.proUntil.getTime() - now.getTime()) / DAY) : 0;
  const bankedMonths = Math.min(REFERRALS.maxBankedMonths, daysLeft / 30.4);

  // Calculator starts from the artist's own last 30 days.
  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const avg = prints ? Math.round(sales.reduce((n, s) => n + s.priceCents, 0) / prints / 100) : 60;
  // "Does it pay for itself?" from those same sales: the extra share Infinity pays on their profit vs the price.
  const worth = paysForItself(
    sales.slice().reverse().map((s) => ({
      quantity: s.quantity,
      profitCents: calcItemProfitCents({ lineTotal: s.priceCents, size: s.size, frameChosen: s.framed, quantity: s.quantity, orderDate: s.date }).profit,
    })),
  );
  const status = planStatus(view, daysLeft);
  const dark = plan.active || view.kind === "payment_failed";
  const freeMonthsUntil = plan.active && plan.proUntil && plan.proUntil.getTime() > now.getTime() + BILLING.minTrialHours * 3_600_000 ? formatPlanDate(plan.proUntil) : null;

  const adds = planFeatures().filter((f) => f.free !== true);
  const plain = (f: (typeof adds)[number]) => (f.label === "Share of profit" ? `${typeof f.pro === "string" ? f.pro : pct(PRO.split)} of profit, up from ${pct(FREE_SPLIT)}` : f.label);
  const featureHref: Record<string, string> = { "Auto videos": "/studio/share", Automations: "/studio/automations" };

  return (
    <StudioPage
      title={plan.active ? "Infinity plan" : <>Go <Brushed>Infinity</Brushed></>}
      sub={plan.active ? `${pct(PRO.split)} of profit on new orders.` : `${proPrice()} a month. Or bring an artist and get it free.`}
      actions={
        <>
          <HelpLink href="/help/growing/infinity-plan" />
          <Link href="/pricing" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Compare plans</Link>
        </>
      }
    >
      {searchParams?.billing === "success" && (
        <p role="status" className="rounded-xl border-[1.5px] border-earned bg-earned-soft px-4 py-3 text-[15px] font-semibold">
          {plan.active ? `You're on ${PRO.name}. New sales pay ${pct(PRO.split)}.` : `Payment received. ${PRO.name} turns on in a moment; refresh if it hasn't.`}
        </p>
      )}

      {/* What you get, the price and the button, in one place */}
      <section id="billing" aria-labelledby="plan-h" className="scroll-mt-20 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className={dark ? "relative grid content-start gap-4 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-ink p-5 text-white sm:p-6" : "af-card grid content-start gap-4 p-5 sm:p-6"}>
          {plan.active && view.kind !== "payment_failed" && <BrushStroke className="pointer-events-none absolute -right-8 top-3 h-10 w-60 rotate-[-4deg]" color="var(--af-sticker)" />}
          {dark ? (
            <div className="relative grid gap-1">
              <h2 id="plan-h" className="text-[13px] font-bold uppercase tracking-[0.08em] !text-white opacity-70">Your plan</h2>
              <p className={`display text-[44px] leading-none ${view.kind === "payment_failed" ? "!text-sticker" : "!text-white"}`}>{status.head}</p>
              <p className="text-[15px] font-semibold">{status.line}</p>
              {status.sub && <p className="text-[13.5px] text-white/80">{status.sub}</p>}
            </div>
          ) : (
            <div className="grid gap-1">
              <h2 id="plan-h" className="text-[20px] font-bold">What you get</h2>
              <p className="text-[14px] text-ink-2">You&apos;re on Free: {pct(FREE_SPLIT)} of profit.</p>
            </div>
          )}
          <ul className="relative grid gap-2">
            {adds.map((f) => (
              <li key={f.label} className="flex items-start gap-2.5 text-[15.5px]">
                <Check className={`mt-1 h-4 w-4 shrink-0 ${dark ? "text-sticker" : "text-earned"}`} aria-hidden="true" />
                {featureHref[f.label] && plan.active ? <Link href={featureHref[f.label]} className="font-bold underline-offset-2 hover:underline">{plain(f)}</Link> : <b>{plain(f)}</b>}
              </li>
            ))}
          </ul>
          {!plan.active && (
            <p className="flex items-baseline gap-1.5">
              <b className="display num text-[40px] leading-none">{proPrice()}</b>
              <span className="text-[14px] text-ink-2">a month</span>
            </p>
          )}
          <div className="relative">
            <BillingPanel mode={billing.mode} kind={view.kind} intervals={billing.intervals} freeMonthsUntil={freeMonthsUntil} onDark={dark} autoStart={searchParams?.start === "1" && !plan.active} />
          </div>
          <p className={dark ? "relative text-[12.5px] text-white/70" : "text-[12.5px] text-ink-2"}>
            The higher share counts for orders placed while {PRO.name} is on. Earlier orders keep theirs.
          </p>
        </div>

        {/* Does it pay for itself? From their own last 30 days */}
        <div className="af-panel grid content-start gap-3 p-5 sm:p-6" aria-labelledby="worth-h" role="region">
          <h2 id="worth-h" className="text-[20px] font-bold">Does it pay for itself?</h2>
          {worth.prints === 0 ? (
            <p className="text-[15px] text-ink-2">No sales in the last 30 days. It pays for itself once the extra {pct(PRO.split - FREE_SPLIT)} passes {proPrice()} a month.</p>
          ) : (
            <>
              <p className={worth.pays ? "rounded-xl border-[1.5px] border-earned bg-earned-soft px-4 py-3 text-[16px] font-semibold" : "rounded-xl border border-line bg-wall px-4 py-3 text-[16px] font-semibold"}>
                {worth.pays
                  ? `Yes. On your last 30 days you'd be ${money(worth.netCents)} ahead.`
                  : `Not yet. Your last 30 days would leave you ${money(-worth.netCents)} short. Referral months cost nothing.`}
              </p>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3"><dt className="text-[12.5px] text-ink-2">Prints, last 30 days</dt><dd className="num text-[20px] font-bold">{worth.prints}</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-[12.5px] text-ink-2">Profit on them</dt><dd className="num text-[20px] font-bold">{money(worth.profitCents)}</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-[12.5px] text-ink-2">Extra {pct(PRO.split - FREE_SPLIT)}</dt><dd className="num text-[20px] font-bold text-earned">+{money(worth.extraCents)}</dd></div>
                <div className="rounded-xl bg-white p-3"><dt className="text-[12.5px] text-ink-2">{PRO.name} costs</dt><dd className="num text-[20px] font-bold">−{money(worth.priceCents)}</dd></div>
              </dl>
            </>
          )}
          <a href="#calc" className="text-[14px] font-bold text-scan">Try other numbers</a>
        </div>
      </section>

      {/* referrals */}
      <section id="referrals" aria-labelledby="ref-h" className="scroll-mt-20 grid gap-5 rounded-2xl border border-line bg-wall p-4 sm:p-6">
        <header className="grid gap-1">
          <span className="eyebrow">Or get it free</span>
          <h2 id="ref-h" className="display text-[30px] sm:text-[40px]">Bring an artist, get <Brushed>{REFERRALS.rewardMonths} months</Brushed> free</h2>
        </header>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_180px] md:items-start">
          <div className="grid gap-4">
            <ReferralShare link={link} code={code} primary={plan.active && view.kind !== "payment_failed"} />
            <ol className="grid gap-1.5 text-[14px]">
              {["They join with your link.", "They get a piece live and print its code, or make a sale.", `${REFERRALS.holdDays} days later, you get ${REFERRALS.rewardMonths} months.`].map((t, i) => (
                <li key={t} className="flex items-center gap-2.5">
                  <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-extrabold text-white">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <figure className="hidden justify-items-center gap-2 rounded-xl bg-white p-4 md:grid">
            <QRCode value={link} dots="rounded" eyes="frame" eyeColor="#2b37f0" className="w-full max-w-[148px]" />
            <figcaption className="text-center text-[12.5px] text-ink-2">Scan to join with your link</figcaption>
          </figure>
        </div>

        <div className="grid gap-2 rounded-xl bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-[15px]">{rewarded} {rewarded === 1 ? "reward" : "rewards"} earned</b>
            <span className="num text-[13.5px] text-ink-2">
              {bankedMonths > 0 ? `${bankedMonths.toFixed(1)} of ${REFERRALS.maxBankedMonths} months banked` : `Bank up to ${REFERRALS.maxBankedMonths} months`}
            </span>
          </div>
          <span className="block h-3 overflow-hidden rounded-full bg-wall" role="progressbar" aria-label="Months of Infinity banked" aria-valuemin={0} aria-valuemax={REFERRALS.maxBankedMonths} aria-valuenow={Math.round(bankedMonths * 10) / 10}>
            <span className="block h-full rounded-full bg-earned" style={{ width: `${(bankedMonths / REFERRALS.maxBankedMonths) * 100}%` }} />
          </span>
          <h3 className="mt-2 text-[15px] font-bold">Artists you brought</h3>
          {referrals.length === 0 ? (
            <p className="text-[14px] text-ink-2">No one yet. Send your link to an artist friend.</p>
          ) : (
            <ul className="grid divide-y divide-line">
              {referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link href={`/@${r.handle}`} className="min-w-0 flex-1 font-semibold text-ink no-underline hover:text-scan">
                    <span className="block truncate">{r.name || r.handle}</span>
                    <span className="block truncate text-[13px] font-normal text-ink-2">@{r.handle} · joined {formatPlanDate(r.joined)}</span>
                  </Link>
                  {(() => {
                    const t = statusText(r);
                    return (
                      <span className="grid justify-items-end text-right">
                        <span className="inline-flex items-center gap-1.5 text-[13.5px] font-bold">
                          <i className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: DAB[r.status] }} aria-hidden="true" />
                          {t.label}
                        </span>
                        {t.note && <span className="text-[12.5px] text-ink-2">{t.note}</span>}
                      </span>
                    );
                  })()}
                </li>
              ))}
            </ul>
          )}
        </div>

        <details className="group text-[13.5px] text-ink-2">
          <summary className="inline-flex min-h-[40px] cursor-pointer list-none items-center font-bold text-ink [&::-webkit-details-marker]:hidden">
            Referral rules <span aria-hidden="true" className="ml-1.5 transition group-open:rotate-180">▾</span>
          </summary>
          <ul className="grid list-disc gap-1 pl-5">
            <li>Months unlock {REFERRALS.holdDays} days after an artist qualifies, if their piece is still live.</li>
            <li>Up to {REFERRALS.maxPerMonth} rewards a month and {REFERRALS.maxBankedMonths} months banked. Extra ones wait their turn.</li>
            <li>Referral months work like paid ones. If you subscribe with months left, the first charge waits.</li>
            <li>Accounts that look like yours (same email domain, network or browser) don&apos;t count.</li>
            <li>We only see sign-ups, not shares. <Link href="/studio/share" className="font-bold text-scan">Share kit</Link></li>
          </ul>
        </details>
      </section>

      <Disclosure id="calc" title={`Is ${PRO.name} worth it for you?`} hint="Calculator">
        <p className="mb-4 text-[14px] text-ink-2">Starts from your last 30 days: {prints} {prints === 1 ? "print" : "prints"}.</p>
        <ProCalculator initialPrints={Math.min(100, prints)} initialPrice={Math.max(45, Math.min(200, avg))} />
      </Disclosure>

      <p className="text-[13px] text-ink-2">
        {billing.mode === "off"
          ? `Card billing is coming soon. Until then ${PRO.name} comes from referrals.`
          : `Billed by Stripe. Cancel anytime from Manage billing; you keep ${PRO.name} to the end of the period you paid for.`}
      </p>
    </StudioPage>
  );
}
