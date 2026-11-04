import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { BrushStroke, Brushed } from "@/components/af/Brush";
import ClaimHandle from "@/components/home/ClaimHandle";
import SplitBar from "@/components/home/SplitBar";
import EarningsCalculator from "@/components/home/EarningsCalculator";
import { DabRow } from "@/components/browse/PageHead";

export const metadata: Metadata = { title: "Sell with us", description: "Free for artists. We print, ship and pay you 60% of the profit." };

const WE_DO: [string, string, string][] = [
  ["var(--af-sticker)", "Printing", "Gallery-quality, made to order."],
  ["var(--af-scan)", "Shipping", "Packed and sent to the buyer."],
  ["var(--af-coral)", "Checkout", "Card, Apple Pay, Google Pay."],
  ["var(--af-earned)", "Payouts", "Venmo, by the 5th, monthly."],
];

const FAQ: [string, React.ReactNode][] = [
  ["Does it cost anything?", "No. No sign-up fee, no subscription, no upfront printing costs. You don’t manage inventory."],
  ["How do I get paid?", "After production and operating costs, each sale’s profit splits 60% to you and 40% to Artfinity. Payouts are calculated monthly and sent through Venmo by the 5th of the following month."],
  ["Who owns my art?", <>You do. You give us a license to show it and print orders while it’s listed. Details in the <Link href="/artist-terms-and-agreement">artist terms</Link>.</>],
  ["Can I set my own prices?", "Yes. Add a markup on any size. Bigger sizes pay more."],
  ["What about taxes?", "Artists report and pay their own taxes. Artfinity doesn’t withhold taxes for you."],
];

export default function SellWithUsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div className="min-w-0">
            <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">Sell with us</span></div>
            <h1 className="display text-[56px] sm:text-[84px]">
              Your art.<br />Our printers.<br /><Brushed color="var(--af-earned-soft)"><span className="text-earned">60% to you.</span></Brushed>
            </h1>
            <p className="mt-5 text-[19px] text-ink-2">Free to join. No inventory. Paid monthly.</p>
            <ClaimHandle className="mt-7" />
          </div>
          <SplitBar />
        </div>
      </section>

      <section className="border-y border-line bg-wall">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
          <div className="grid items-end gap-6 md:grid-cols-[1fr_auto]">
            <h2 className="display text-[44px] sm:text-[60px]">You paint. We do the rest.</h2>
          </div>
          <ul className="mt-10 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
            {WE_DO.map(([c, t, s]) => (
              <li key={t} className="grid content-start gap-1.5 border-t-[3px] border-ink pt-4">
                <span className="paint-dab mb-1 h-5 w-5" style={{ ["--dab" as string]: c }} aria-hidden="true" />
                <b className="font-display text-[24px] leading-none [font-variation-settings:'wdth'_80]">{t}</b>
                <span className="text-[14.5px] text-ink-2">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <h2 className="display mb-10 max-w-[14ch] text-[44px] sm:text-[60px]">Try your numbers</h2>
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
      </section>

      <section className="relative overflow-hidden bg-ink text-white">
        <BrushStroke className="pointer-events-none absolute -right-20 top-8 h-12 w-[380px] -rotate-[5deg] opacity-30" color="var(--af-sticker)" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <h2 className="display text-[48px] text-white sm:text-[68px]">Claim your page.</h2>
          <ClaimHandle dark className="lg:justify-self-end" />
        </div>
      </section>
    </>
  );
}
