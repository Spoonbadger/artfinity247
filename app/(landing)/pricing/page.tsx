import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Brushed, BrushStroke } from "@/components/af/Brush";
import { DabRow } from "@/components/browse/PageHead";
import { PUBLIC_ART } from "@/components/browse/data";
import ProCalculator from "@/components/pro/ProCalculator";
import { FREE_SPLIT, PRO, REFERRALS, pct, planFeatures, proPrice, type Feature } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pricing",
  description: `Free to sell, ${pct(FREE_SPLIT)} of profit. Infinity is ${proPrice()} a month: ${pct(PRO.split)} of profit, auto videos and automations.`,
};

function Cell({ v, dark = false }: { v: Feature["free"]; dark?: boolean }) {
  if (v === false) return <Minus className={`h-4 w-4 shrink-0 ${dark ? "text-white/75" : "text-ink-2"}`} aria-label="Not included" />;
  return <Check className={`h-4 w-4 shrink-0 ${dark ? "text-sticker" : "text-earned"}`} aria-label="Included" />;
}

function FeatureList({ which, dark = false }: { which: "free" | "pro"; dark?: boolean }) {
  // Infinity lists what it adds; Free lists everything, with Infinity-only rows dimmed.
  const rows = which === "pro" ? planFeatures().filter((f) => f.free !== true) : planFeatures();
  return (
    <ul className="grid gap-2.5">
      {which === "pro" && (
        <li className="flex items-start gap-2.5 text-[15px]">
          <span className="mt-[3px]"><Cell v dark={dark} /></span>
          <span>Everything in Free, plus</span>
        </li>
      )}
      {rows.map((f) => {
        const v = f[which];
        return (
          <li key={f.label} className={`flex items-start gap-2.5 text-[15px] ${v === false ? (dark ? "text-white/75" : "text-ink-2") : ""}`}>
            <span className="mt-[3px]"><Cell v={v} dark={dark} /></span>
            <span>
              {f.label}
              {v === false && <span className="text-[13px]"> · {PRO.name} only</span>}
              {typeof v === "string" && <b className={dark ? "text-sticker" : "text-ink"}> · {v}</b>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const FAQ: [string, string][] = [
  ["How am I billed?", `${proPrice()} a month by card, through Stripe, plus sales tax where it applies. Change your card or download invoices anytime from Manage billing in your Studio.`],
  ["Can I cancel?", "Anytime, from Manage billing. Infinity runs to the end of the period you paid for, then you’re on Free. No partial refunds."],
  ["What happens to my split if I go back to Free?", `New orders pay ${pct(FREE_SPLIT)}. Your art, page, codes and links all stay.`],
  ["Do old orders change?", "No. Every order keeps the split from the moment it was placed."],
  ["How do I get Infinity free?", `Share your link. Each artist who joins, gets a piece live and prints a code or makes a sale gives you ${REFERRALS.rewardMonths} months, up to ${REFERRALS.maxBankedMonths} banked.`],
  ["Do free months stack with a subscription?", "Yes. Subscribe while you have free months and the first charge waits until they run out. Months earned later push your next charge back."],
];

export default async function PricingPage() {
  const art = await prisma.artwork.findMany({
    where: { ...PUBLIC_ART, sensitive: { isEmpty: true } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { slug: true, title: true, imageUrl: true },
  });

  return (
    <>
      <section className="mx-auto grid max-w-[1240px] items-end gap-8 px-4 pb-10 pt-10 sm:px-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:pt-16">
        <div>
          <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">Pricing</span></div>
          <h1 className="display max-w-[12ch] text-[52px] sm:text-[84px]">Free to sell. <Brushed>Infinity</Brushed> to grow.</h1>
          <p className="mt-5 max-w-[34ch] text-[18px] text-ink-2 sm:text-[20px]">
            Free keeps {pct(FREE_SPLIT)} of profit. Infinity keeps {pct(PRO.split)}, for {proPrice()} a month.
          </p>
        </div>
        {art.length > 0 && (
          <div className="hidden items-end justify-end gap-3 md:flex" aria-hidden="true">
            {art.map((a, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.slug}
                src={a.imageUrl}
                alt=""
                className={`rounded-[3px] border-[6px] border-white object-cover shadow-[0_6px_18px_rgba(21,22,27,.22)] ${["h-40 w-32 -rotate-2", "h-56 w-40", "h-44 w-36 rotate-2"][i]}`}
              />
            ))}
          </div>
        )}
      </section>

      {/* plans */}
      <section aria-label="Plans" className="mx-auto grid max-w-[1240px] gap-4 px-4 pb-16 sm:px-6 md:grid-cols-2 md:gap-6">
        <div className="af-card grid content-start gap-5 p-5 sm:p-7">
          <div className="grid gap-1">
            <h2 className="display text-[36px] leading-none">Free</h2>
            <p className="display num text-[56px] leading-none">$0</p>
            <p className="text-[15px] text-ink-2">Everything you need to sell.</p>
          </div>
          <Link href="/register" className="btn btn-ghost btn-lg w-full">Start selling free</Link>
          <FeatureList which="free" />
        </div>

        <div className="relative grid content-start gap-5 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-ink p-5 text-white sm:p-7">
          <BrushStroke className="pointer-events-none absolute -right-10 top-6 h-12 w-72 rotate-[-4deg]" color="var(--af-sticker)" />
          <div className="relative grid gap-1">
            <h2 className="display flex items-center gap-3 text-[36px] leading-none !text-white">Infinity plan</h2>
            <p className="display num text-[56px] leading-none !text-white">{proPrice()}<span className="text-[20px] text-white/70">/mo</span></p>
            <p className="text-[15px] text-white/75">{pct(PRO.split)} of profit, and the tools that sell more.</p>
          </div>
          <div className="relative grid gap-2">
            <Link href="/studio/infinity#billing" className="btn btn-sticker btn-lg w-full">Get {PRO.name} — {proPrice()}/month</Link>
            <span className="text-center text-[12.5px] text-white/70">Billed monthly by Stripe. Cancel anytime.</span>
            <Link href="/studio/infinity#referrals" className="text-center text-[14px] font-bold text-white underline-offset-2 hover:underline">Or share Artfinity, get 2 months free</Link>
          </div>
          <div className="relative"><FeatureList which="pro" dark /></div>
        </div>
      </section>

      {/* calculator */}
      <section id="calculator" aria-labelledby="calc-h" className="scroll-mt-20 border-y border-line bg-wall">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-14 sm:px-6 md:py-20">
          <header className="grid gap-2">
            <h2 id="calc-h" className="display text-[40px] sm:text-[56px]">Is Infinity worth it for you?</h2>
            <p className="text-[16px] text-ink-2">Slide to your numbers.</p>
          </header>
          <div className="rounded-2xl border border-line bg-white p-4 sm:p-7">
            <ProCalculator />
          </div>
        </div>
      </section>

      {/* faq */}
      <section aria-labelledby="faq-h" className="mx-auto grid max-w-[880px] gap-6 px-4 py-14 sm:px-6 md:py-20">
        <h2 id="faq-h" className="display text-[40px] sm:text-[52px]">Questions</h2>
        <div className="grid divide-y divide-line border-y border-line">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="paint-dab transition group-open:rotate-90" style={{ ["--dab" as string]: "var(--af-scan)" }} />
              </summary>
              <p className="pb-4 text-[16px] text-ink-2">{a}</p>
            </details>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/register" className="btn btn-blue btn-lg">Start selling free</Link>
          <Link href="/studio/infinity" className="btn btn-ghost btn-lg">Try Infinity</Link>
        </div>
      </section>
    </>
  );
}
