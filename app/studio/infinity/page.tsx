import Link from "next/link";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Brushed, BrushStroke } from "@/components/af/Brush";
import QRCode from "@/components/af/QRCode";
import { StudioPage } from "@/components/studio/StudioPage";
import TrialButton from "@/components/pro/TrialButton";
import ReferralShare from "@/components/pro/ReferralShare";
import ProCalculator from "@/components/pro/ProCalculator";
import { getArtistPlan } from "@/components/pro/plan.server";
import { FREE_SPLIT, PRO, REFERRALS, formatPlanDate, pct, planFeatures, proPrice } from "@/lib/plans";
import { ensureReferralCode, getReferrals, referralLink, type ReferralRow, type ReferralStatus } from "@/lib/referrals";
import { testCheckoutAllowed } from "@/lib/testCheckout";
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

export default async function ProPage() {
  const artist = await requireArtist("/studio/infinity");
  const now = new Date();
  // Referrals first: getting them settles any months that came due, so the plan below is current.
  const referrals = await getReferrals(artist.id);
  const [plan, code, sales] = await Promise.all([
    getArtistPlan(artist.id),
    ensureReferralCode(artist.id),
    getSales(artist.id, new Date(now.getTime() - 30 * DAY)),
  ]);
  const link = referralLink(code);
  const rewarded = referrals.filter((r) => r.status === "rewarded").length;
  const daysLeft = plan.active && plan.proUntil ? Math.ceil((plan.proUntil.getTime() - now.getTime()) / DAY) : 0;
  const bankedMonths = Math.min(REFERRALS.maxBankedMonths, daysLeft / 30.4);

  // Calculator starts from the artist's own last 30 days.
  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const avg = prints ? Math.round(sales.reduce((n, s) => n + s.priceCents, 0) / prints / 100) : 60;

  return (
    <StudioPage
      title={plan.active ? <span className="inline-flex flex-wrap items-center gap-3">Infinity plan</span> : <>Go <Brushed>Infinity</Brushed></>}
      sub={plan.active ? `${pct(PRO.split)} of profit, videos, automations.` : `${proPrice()} a month. Or share Artfinity and get it free.`}
      actions={
        <>
          <Link href="/studio/automations" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Automations</Link>
          <Link href="/pricing" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">Pricing</Link>
        </>
      }
    >
      {/* current plan */}
      <section aria-labelledby="plan-h" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className={plan.active ? "relative grid content-start gap-3 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-ink p-5 text-white" : "af-card grid content-start gap-3 p-5"}>
          {plan.active && <BrushStroke className="pointer-events-none absolute -right-8 top-3 h-10 w-60 rotate-[-4deg]" color="var(--af-sticker)" />}
          <h2 id="plan-h" className="relative text-[13px] font-bold uppercase tracking-[0.08em] opacity-70">Your plan</h2>
          <p className={`display relative text-[44px] leading-none ${plan.active ? "!text-white" : ""}`}>{plan.active ? "Infinity" : "Free"}</p>
          {plan.active && plan.proUntil ? (
            <p className="relative text-[15px]">
              Until <b>{formatPlanDate(plan.proUntil)}</b> · {daysLeft} {daysLeft === 1 ? "day" : "days"} left
            </p>
          ) : (
            <p className="text-[15px] text-ink-2">You keep {pct(FREE_SPLIT)} of profit. Everything core is free.</p>
          )}
          <p className={plan.active ? "relative text-[13px] text-white/70" : "text-[13px] text-ink-2"}>
            Orders keep the split from when they were placed.
          </p>
          <div className="relative mt-1">
            <TrialButton devTrial={testCheckoutAllowed()} active={plan.active} onDark={plan.active} />
          </div>
        </div>

        <div className="af-panel grid content-start gap-3 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[20px] font-bold">Infinity plan, {proPrice()}/mo</h2>
            <Link href="/pricing" className="text-[14px] font-bold text-scan">Compare</Link>
          </div>
          <ul className="grid gap-2">
            {planFeatures().filter((f) => f.free !== true).map((f) => (
              <li key={f.label} className="flex items-start gap-2.5 text-[15px]">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-earned" aria-hidden="true" />
                <span><b>{f.label}</b>{typeof f.pro === "string" ? <span className="text-ink-2"> · {f.pro}</span> : null}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* referrals */}
      <section id="referrals" aria-labelledby="ref-h" className="scroll-mt-20 grid gap-5 rounded-2xl border border-line bg-wall p-4 sm:p-6">
        <header className="grid gap-1">
          <span className="eyebrow">Referrals</span>
          <h2 id="ref-h" className="display text-[34px] sm:text-[44px]">Share Artfinity, get <Brushed>2 months</Brushed> of Infinity</h2>
          <p className="text-[15px] text-ink-2">For every artist who joins with your link, gets a piece live, and prints its code or makes a sale.</p>
        </header>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_200px] md:items-start">
          <div className="grid gap-5">
            <ReferralShare link={link} code={code} />

            <ol className="grid gap-2 sm:grid-cols-3">
              {["They join with your link", "They get a piece live and print a code (or sell)", `${REFERRALS.holdDays} days later, you get ${REFERRALS.rewardMonths} months`].map((t, i) => (
                <li key={t} className="flex items-center gap-2.5 rounded-xl bg-white p-3 text-[14px] font-semibold">
                  <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-extrabold text-white">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>

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
            </div>
          </div>

          <figure className="grid justify-items-center gap-2 rounded-xl bg-white p-4">
            <QRCode value={link} dots="rounded" eyes="frame" eyeColor="#2b37f0" className="w-full max-w-[168px]" />
            <figcaption className="text-center text-[12.5px] text-ink-2">Scan to join with your link</figcaption>
          </figure>
        </div>

        <div className="grid gap-2">
          <h3 className="text-[17px] font-extrabold">Artists you brought</h3>
          {referrals.length === 0 ? (
            <p className="rounded-xl bg-white p-4 text-[14px] text-ink-2">No one yet. Send your link to an artist friend.</p>
          ) : (
            <ul className="grid divide-y divide-line rounded-xl bg-white">
              {referrals.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 sm:px-4">
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

        <div className="grid gap-1 border-t border-dashed border-ink/20 pt-4 text-[13.5px] text-ink-2">
          <p>
            <b className="text-ink">Sharing your page counts too, once it brings an artist.</b> We can’t see shares, only sign-ups, so rewards come from artists who join and get going.{" "}
            <Link href="/studio/share" className="font-bold text-scan">Share kit</Link>
          </p>
          <p>
            Months unlock {REFERRALS.holdDays} days after an artist qualifies, if their piece is still live. Up to {REFERRALS.maxPerMonth} rewards a month and {REFERRALS.maxBankedMonths} months banked at a time; anything over waits its turn.
            Accounts that look like your own (same email domain, and the same network or browser) don’t earn a reward.
          </p>
        </div>
      </section>

      {/* worth it? */}
      <section aria-labelledby="calc-h" className="af-panel grid gap-5 p-4 sm:p-6">
        <header className="grid gap-1">
          <h2 id="calc-h" className="display text-[30px] sm:text-[36px]">Is Infinity worth it for you?</h2>
          <p className="text-[14px] text-ink-2">Starts from your last 30 days: {prints} {prints === 1 ? "print" : "prints"}.</p>
        </header>
        <ProCalculator initialPrints={Math.min(100, prints)} initialPrice={Math.max(45, Math.min(200, avg))} />
      </section>

      <p className="flex items-center gap-2 text-[13px] text-ink-2">
        <Minus className="h-4 w-4" aria-hidden="true" /> Billing arrives with the backend. Until then Infinity comes from referrals.
      </p>
    </StudioPage>
  );
}
