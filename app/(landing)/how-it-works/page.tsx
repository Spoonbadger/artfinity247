import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Brushed } from "@/components/af/Brush";
import QRCode from "@/components/af/QRCode";
import SplitBar from "@/components/home/SplitBar";
import ClaimHandle from "@/components/home/ClaimHandle";
import { PaintNumber } from "@/components/home/HowItWorks";
import { getHeroData } from "@/components/home/heroData";
import { SIZE_IN } from "@/components/art/pricing";
import { breakdown, money, SIZE_NAME, type SizeKey } from "@/lib/earnings";
import { PRINT_BUSINESS_DAYS, SHIP_BUSINESS_DAYS } from "@/lib/delivery";
import { HELP_DAYS_AFTER_DELIVERY } from "@/lib/reprintFormat";
import { FREE_SPLIT, PRO, REFERRALS, pct, proPrice, proYearlyPrice } from "@/lib/plans";
import { scanUrl } from "@/lib/qr/render";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "How it works",
  description: `Hang a code by your painting. Anyone who scans can buy a print, made to order and shipped free in the US. You keep ${pct(FREE_SPLIT)} of the profit.`,
};

const SIZES: SizeKey[] = ["small", "medium", "large", "xl"];
const daysLow = PRINT_BUSINESS_DAYS.min + SHIP_BUSINESS_DAYS.min;
const daysHigh = PRINT_BUSINESS_DAYS.max + SHIP_BUSINESS_DAYS.max;

const FAQ: [string, string][] = [
  ["Does it cost anything to sell?", `No. Free has no monthly fee. Artfinity only earns when you sell, from its share of each print's profit.`],
  ["Who sets the price?", "You do. Every print has a base price that covers printing and shipping, and you add what you like on top."],
  ["When do I get paid?", "By the 5th of the next month, straight to your bank through Stripe. Each sale is held 14 days first, in case something goes wrong with the print."],
  ["What if a print arrives damaged?", `The buyer sends a photo within ${HELP_DAYS_AFTER_DELIVERY} days of delivery and we reprint it free. They don't need to send it back.`],
  ["Can buyers return a print?", "Not for a change of mind or the wrong size. Every print is made to order."],
  [`How do I get ${PRO.name} free?`, `Share your link. Each artist who joins, gets a piece live and prints a code or makes a sale gives you ${REFERRALS.rewardMonths} months of ${PRO.name}.`],
];

const OVERVIEW = [
  { title: "Hang your code", note: "Upload a photo. Print the code it makes.", color: "var(--af-sticker)" },
  { title: "Someone scans", note: "They pick a size and pay. No app.", color: "var(--af-scan)" },
  { title: "We print and ship", note: `Made to order. Free US shipping.`, color: "var(--af-coral)" },
  { title: "You get paid", note: `${pct(FREE_SPLIT)} of the profit, by the 5th.`, color: "var(--af-earned)" },
];

function Step({ n, color, title, children, visual, flip = false }: { n: number; color: string; title: string; children: React.ReactNode; visual: React.ReactNode; flip?: boolean }) {
  return (
    <li id={`step-${n}`} className="grid scroll-mt-24 items-center gap-8 md:grid-cols-2 md:gap-14">
      <div className={cn("grid content-start gap-4", flip && "md:order-2")}>
        <div className="flex items-center gap-3">
          <PaintNumber n={n} color={color} />
          <h2 className="t-feature">{title}</h2>
        </div>
        <div className="grid gap-3 text-[17px] leading-relaxed text-ink-2">{children}</div>
      </div>
      <div className={cn("grid min-h-[300px] place-items-center rounded-2xl bg-wall p-6 sm:p-8", flip && "md:order-1")} aria-hidden="true">{visual}</div>
    </li>
  );
}

export default async function HowItWorksPage() {
  const { heroArt, markup } = await getHeroData();
  const qr = heroArt ? scanUrl(heroArt.slug, heroArt.artist.slug) : "https://theartfinity.com";

  return (
    <>
      {/* opening: the whole loop at a glance, each step a jump link (the home page has the animated scene) */}
      <section className="mx-auto grid max-w-[1240px] gap-10 px-4 pb-14 pt-10 sm:px-6 md:gap-14 md:pb-20 md:pt-16">
        <div className="grid justify-items-center gap-5 text-center">
          <h1 className="display text-[56px] sm:text-[80px] lg:text-[92px]">
            From paint to <Brushed color="var(--af-sticker)"><span className="text-scan">print.</span></Brushed>
          </h1>
          <p className="max-w-[40ch] text-[19px] leading-snug text-ink-2 sm:text-[21px]">One code by your painting. Here&apos;s everything that happens after someone scans it.</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-5">
          {OVERVIEW.map((o, i) => (
            <li key={o.title} className="relative">
              <a href={`#step-${i + 1}`} className="group grid h-full content-start justify-items-center gap-2 rounded-2xl px-3 py-4 text-center no-underline transition hover:bg-wall">
                <PaintNumber n={i + 1} color={o.color} />
                <b className="text-[18px] text-ink group-hover:text-scan">{o.title}</b>
                <span className="text-[14.5px] leading-snug text-ink-2">{o.note}</span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* the four steps */}
      <section aria-label="The steps" className="border-t border-line">
        <ol className="mx-auto grid max-w-[1240px] gap-16 px-4 py-16 sm:px-6 md:gap-24 md:py-24">
          <Step
            n={1}
            color="var(--af-sticker)"
            title="Hang your code"
            visual={
              <div className="flex items-end gap-5">
                {heroArt && (
                  <div className="w-[150px] rotate-[-2deg] bg-white p-[6px] shadow-[0_16px_26px_-12px_rgba(21,22,27,.5)] ring-[4px] ring-ink sm:w-[180px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroArt.imageUrl} alt="" className="aspect-[4/5] w-full object-cover" loading="lazy" />
                  </div>
                )}
                <div className="relative w-[96px] rotate-[3deg] rounded-md bg-white p-2 shadow-[0_10px_22px_-6px_rgba(21,22,27,.35)] sm:w-[110px]">
                  <span className="absolute -top-2 left-1/2 h-3.5 w-10 -translate-x-1/2 -rotate-3 bg-sticker/80" />
                  <QRCode value={qr} dots="rounded" eyes="frame" eyeColor="#8b2a4b" />
                  <b className="mt-1 block text-[10.5px] leading-tight">Scan to buy a print</b>
                </div>
              </div>
            }
          >
            <p>Upload a photo of your painting. Artfinity makes a code for it.</p>
            <p>Print the code and put it up next to the piece: in a café, a gallery, a pop-up, your own hallway.</p>
          </Step>

          <Step
            n={2}
            color="var(--af-scan)"
            flip
            title="Someone scans"
            visual={
              <div className="w-[240px] rounded-[30px] border-[7px] border-ink bg-white p-3 shadow-[0_22px_40px_-14px_rgba(21,22,27,.5)]">
                <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" />
                {heroArt && (
                  <div className="flex items-center gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroArt.imageUrl} alt="" className="h-14 w-11 shrink-0 object-cover shadow" loading="lazy" />
                    <span className="min-w-0 leading-tight">
                      <b className="block truncate text-[14px]">{heroArt.title}</b>
                      <span className="block truncate text-[12px] text-ink-2">{heroArt.artist.name}</span>
                    </span>
                  </div>
                )}
                <ul className="mt-3 grid gap-1.5">
                  {SIZES.map((s) => (
                    <li key={s} className={cn("flex items-center justify-between rounded-lg border-[1.5px] px-2.5 py-1.5 text-[12.5px]", s === "medium" ? "border-ink bg-ink text-white" : "border-line")}>
                      <span><b>{SIZE_NAME[s]}</b> <span className={s === "medium" ? "text-white/75" : "text-ink-2"}>{SIZE_IN[s][0]} × {SIZE_IN[s][1]} in</span></span>
                      <b className="num">{money(breakdown(s, markup[s]).price)}</b>
                    </li>
                  ))}
                </ul>
                <span className="mt-3 block rounded-full bg-scan py-2 text-center text-[13px] font-bold text-white">Buy this print</span>
              </div>
            }
          >
            <p>They pick a size and pay on their phone. No app, no account.</p>
            <p>Four sizes, from {SIZE_IN.small[0]} × {SIZE_IN.small[1]} up to {SIZE_IN.xl[0]} × {SIZE_IN.xl[1]} inches, framed or not. You set the price; the base covers printing and shipping.</p>
          </Step>

          <Step
            n={3}
            color="var(--af-coral)"
            title="We print and ship"
            visual={
              <ol className="grid w-full max-w-[340px] gap-0">
                {[
                  { what: "Ordered", when: "Today" },
                  { what: "Printed", when: `${PRINT_BUSINESS_DAYS.min} to ${PRINT_BUSINESS_DAYS.max} business days` },
                  { what: "At their door", when: `${SHIP_BUSINESS_DAYS.min} to ${SHIP_BUSINESS_DAYS.max} more, free, with tracking` },
                ].map((s, i, all) => (
                  <li key={s.what} className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-3 pb-6 last:pb-0">
                    {i < all.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-[2px] bg-line" />}
                    <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold", i === all.length - 1 ? "bg-earned text-white" : "bg-white text-ink ring-[1.5px] ring-ink")}>{i + 1}</span>
                    <span className="grid rounded-xl bg-white px-3.5 py-2.5 shadow-[0_6px_14px_-8px_rgba(21,22,27,.35)]">
                      <b className="text-[15px]">{s.what}</b>
                      <span className="text-[13.5px] text-ink-2">{s.when}</span>
                    </span>
                  </li>
                ))}
              </ol>
            }
          >
            <p>Every print is made to order and shipped free in the US. Most arrive in {daysLow} to {daysHigh} business days.</p>
            <p>If one arrives damaged, we reprint it free.</p>
          </Step>

          <Step n={4} color="var(--af-earned)" flip title="You get paid" visual={<div className="w-full max-w-[460px]"><SplitBar markupCents={markup.medium} /></div>}>
            <p>You keep {pct(FREE_SPLIT)} of the profit on every print: what&apos;s left after printing, shipping and the card fee.</p>
            <p>It&apos;s paid to your bank through Stripe by the 5th of the next month.</p>
          </Step>
        </ol>
      </section>

      {/* Infinity, briefly */}
      <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6 md:pb-24">
        <div className="grid gap-5 rounded-2xl bg-ink p-6 text-white sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="grid gap-2">
            <h2 className="t-feature !text-white">Keep {pct(PRO.split)} with {PRO.name}</h2>
            <p className="text-[17px] text-white/75">{proPrice()} a month, or {proYearlyPrice()} a year. It also makes the reels for you.</p>
          </div>
          <Link href="/pricing" className="btn btn-sticker btn-lg">See pricing</Link>
        </div>
      </section>

      {/* for people buying */}
      <section aria-labelledby="buy-h" className="border-y border-line bg-wall">
        <div className="mx-auto grid max-w-[1240px] gap-6 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:py-20">
          <div className="grid gap-2">
            <h2 id="buy-h" className="t-feature">Just here for art?</h2>
            <p className="max-w-[52ch] text-[17px] text-ink-2">Scan a code when you see one beside a painting, or browse from home. Every print is made for you and ships free in the US.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/art" className="btn btn-blue btn-lg">Browse art</Link>
            <Link href="/artists" className="btn btn-ghost btn-lg bg-white">Artists</Link>
            <Link href="/scenes" className="btn btn-ghost btn-lg bg-white">Neighborhoods</Link>
          </div>
        </div>
      </section>

      {/* questions */}
      <section aria-labelledby="faq-h" className="mx-auto grid max-w-[880px] gap-6 px-4 py-14 sm:px-6 md:py-20">
        <h2 id="faq-h" className="t-feature">Questions</h2>
        <div className="grid divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 t-card [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="t-body pb-4 text-ink-2">{a}</p>
            </details>
          ))}
        </div>
        <Link href="/help" className="inline-flex items-center gap-1 text-[15px] font-semibold text-ink underline-offset-2 hover:underline">
          More in the help center <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* start */}
      <section aria-labelledby="start-h" className="border-t border-line">
        <div className="mx-auto grid max-w-[640px] justify-items-center gap-5 px-4 py-16 text-center sm:px-6 md:py-24">
          <h2 id="start-h" className="t-feature">Claim your name</h2>
          <ClaimHandle className="w-full text-left" />
        </div>
      </section>
    </>
  );
}
