import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Brushed } from "@/components/af/Brush";
import ClaimHandle from "@/components/home/ClaimHandle";
import SplitBar from "@/components/home/SplitBar";
import EarningsCalculator from "@/components/home/EarningsCalculator";
import { FREE_SPLIT, PRO, pct, proPrice } from "@/lib/plans";
import { RETURN_WINDOW_DAYS } from "@/lib/balance";
import { PAYOUT_DAY } from "@/content/help/facts";
import BrushWipe from "@/components/motion/BrushWipe";
import { PAINTING_SCANS } from "@/lib/features";

export const metadata: Metadata = { title: "Sell with us", description: `Free for artists. We print, ship and pay you ${pct(FREE_SPLIT)} of the profit.` };

const WE_DO: [string, string, string][] = [
  ["var(--af-sticker)", "Printing", "Giclée on archival paper, made to order in NYC."],
  ["var(--af-scan)", "Shipping", "Free to US buyers, with tracking."],
  ["var(--af-coral)", "Checkout", "Card, Apple Pay, Google Pay."],
  ["var(--af-earned)", "Payouts", `To your bank via Stripe by the ${PAYOUT_DAY}.`],
];

const FAQ: [string, React.ReactNode][] = [
  ["Does it cost anything?", `No. Joining, listing and printing cost you nothing. Infinity is optional, at ${proPrice()} a month.`],
  ["How do I get paid?", `You get ${pct(FREE_SPLIT)} of the profit on each print (${pct(PRO.split)} on Infinity). Each sale is held ${RETURN_WINDOW_DAYS} days for returns. A month's sales are paid by the ${PAYOUT_DAY} of the next month, to your bank through Stripe.`],
  ["Who owns my art?", <>You do. We get a limited license to print, sell and promote it while it&apos;s listed. We never use it to train AI. See the <Link href="/artist-terms-and-agreement">artist terms</Link>.</>],
  ["Can I set my own prices?", "Yes. You set a markup on each size, on top of the base price."],
  ["What about shipping?", "Shipping is free for US buyers and already in the print cost. Sales tax is added at checkout and never comes out of your share."],
  ["What if a print arrives damaged?", "We reprint it free for the buyer. Artfinity pays for reprints, not you."],
  ["What about taxes?", "You report and pay your own income tax. We don’t withhold any."],
];

export default function SellWithUsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="min-w-0">
            <h1 className="display text-[56px] sm:text-[84px]">
              Your art.<br />Our printers.<br /><Brushed color="var(--af-earned-soft)"><span className="text-earned">{pct(FREE_SPLIT)} to you.</span></Brushed>
            </h1>
            <p className="mt-5 text-[19px] text-ink-2">Free to join. Paid by the {PAYOUT_DAY} of every month.</p>
            <ClaimHandle className="mt-7" />
          </div>
          <SplitBar />
        </div>
      </section>

      <section className="border-y border-line bg-wall">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
          <h2 className="t-feature">You paint. We do the rest.</h2>
          <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {WE_DO.map(([, t, s]) => (
              <li key={t} className="grid content-start gap-1.5 border-t-[3px] border-ink pt-4">
                <b className="t-card">{t}</b>
                <span className="t-muted">{s}</span>
              </li>
            ))}
          </ul>
          {PAINTING_SCANS && <Link href="/scanning" className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-edge bg-white px-5 py-4 text-ink no-underline transition hover:border-ink hover:-translate-y-0.5">
            <span className="min-w-0">
              <b className="t-card block">Only have phone photos?</b>
              <span className="t-muted">We scan originals in NYC so you can sell bigger prints.</span>
            </span>
            <span className="font-bold text-scan">Painting scans →</span>
          </Link>}
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <h2 className="t-feature relative mb-8 inline-block"><span className="relative z-10">Try your numbers</span><BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-earned)" style={{ opacity: 0.35 }} /></h2>
        <EarningsCalculator />
      </section>

      <section className="mx-auto max-w-[820px] px-4 pb-20 sm:px-6">
        <h2 className="t-feature mb-4">Questions</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 t-card [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="t-body pb-5 text-ink-2 [&_a]:font-semibold [&_a]:text-scan [&_a]:underline">{a}</p>
            </details>
          ))}
        </div>
        <p className="t-small mt-4">Last updated: November 5, 2026</p>
      </section>

      <section className="relative overflow-hidden bg-ink text-white">
        <BrushWipe className="pointer-events-none absolute -right-20 top-8 h-12 w-[380px] -rotate-[5deg] opacity-30" color="var(--af-sticker)" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <h2 className="t-page text-white">Claim your page.</h2>
          <ClaimHandle dark className="lg:justify-self-end" />
        </div>
      </section>
    </>
  );
}
