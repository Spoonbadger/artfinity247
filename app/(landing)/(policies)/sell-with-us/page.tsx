import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Brushed } from "@/components/af/Brush";
import ClaimHandle from "@/components/home/ClaimHandle";
import SplitBar from "@/components/home/SplitBar";
import EarningsCalculator from "@/components/home/EarningsCalculator";
import { DabRow } from "@/components/browse/PageHead";
import Splat from "@/components/motion/Splat";
import { FREE_SPLIT, PRO, pct, proPrice } from "@/lib/plans";
import { RETURN_WINDOW_DAYS } from "@/lib/balance";
import { PAYOUT_DAY } from "@/content/help/facts";
import BrushWipe from "@/components/motion/BrushWipe";

export const metadata: Metadata = { title: "Sell with us", description: `Free for artists. We print, ship and pay you ${pct(FREE_SPLIT)} of the profit.` };

const WE_DO: [string, string, string][] = [
  ["var(--af-sticker)", "Printing", "Gallery-quality, made to order."],
  ["var(--af-scan)", "Shipping", "Packed and sent to the buyer."],
  ["var(--af-coral)", "Checkout", "Card, Apple Pay, Google Pay."],
  ["var(--af-earned)", "Payouts", `To your bank or Venmo by the ${PAYOUT_DAY}.`],
];

const FAQ: [string, React.ReactNode][] = [
  ["Does it cost anything?", `No. Joining, listing and printing cost you nothing. Infinity is optional, at ${proPrice()} a month.`],
  ["How do I get paid?", `You get ${pct(FREE_SPLIT)} of the profit on each print (${pct(PRO.split)} on Infinity). Each sale is held ${RETURN_WINDOW_DAYS} days for returns. A month's sales are paid by the ${PAYOUT_DAY} of the next month, to your bank or Venmo.`],
  ["Who owns my art?", <>You do. We get a limited license to print, sell and promote it while it&apos;s listed. We never use it to train AI. See the <Link href="/artist-terms-and-agreement">artist terms</Link>.</>],
  ["Can I set my own prices?", "Yes. You set a markup on each size, on top of the base price."],
  ["What about shipping?", "Shipping is free for US buyers and already in the print cost. Sales tax is added at checkout and never comes out of your share."],
  ["What about taxes?", "You report and pay your own income tax. We don’t withhold any."],
];

export default function SellWithUsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">Sell with us</span></div>
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
          <h2 className="display text-[44px] sm:text-[60px]">You paint. We do the rest.</h2>
          <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {WE_DO.map(([c, t, s]) => (
              <li key={t} className="grid content-start gap-1.5 border-t-[3px] border-ink pt-4">
                <Splat><span className="paint-dab mb-1 h-5 w-5" style={{ ["--dab" as string]: c }} aria-hidden="true" /></Splat>
                <b className="font-display text-[24px] leading-none [font-variation-settings:'wdth'_80]">{t}</b>
                <span className="text-[14.5px] text-ink-2">{s}</span>
              </li>
            ))}
          </ul>
          <Link href="/scanning" className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-edge bg-white px-5 py-4 text-ink no-underline transition hover:border-ink hover:-translate-y-0.5">
            <span className="min-w-0">
              <b className="block font-display text-[22px] leading-tight [font-variation-settings:'wdth'_80]">Only have phone photos?</b>
              <span className="text-[15px] text-ink-2">We scan originals in NYC so you can sell bigger prints.</span>
            </span>
            <span className="font-bold text-scan">Painting scans →</span>
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <h2 className="display relative mb-10 inline-block text-[44px] sm:text-[60px]"><span className="relative z-10">Try your numbers</span><BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-earned)" style={{ opacity: 0.35 }} /></h2>
        <EarningsCalculator />
      </section>

      <section className="mx-auto max-w-[820px] px-4 pb-20 sm:px-6">
        <h2 className="display mb-6 text-[40px] sm:text-[52px]">Questions</h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-[16.5px] leading-relaxed text-ink-2 [&_a]:font-semibold [&_a]:text-scan [&_a]:underline">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[14px] text-ink-2">Last updated: November 5, 2026</p>
      </section>

      <section className="relative overflow-hidden bg-ink text-white">
        <BrushWipe className="pointer-events-none absolute -right-20 top-8 h-12 w-[380px] -rotate-[5deg] opacity-30" color="var(--af-sticker)" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <h2 className="display text-[48px] text-white sm:text-[68px]">Claim your page.</h2>
          <ClaimHandle dark className="lg:justify-self-end" />
        </div>
      </section>
    </>
  );
}
