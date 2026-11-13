import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronDown, Minus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Brushed, BrushStroke } from "@/components/af/Brush";
import { PUBLIC_ART, displayName } from "@/components/browse/data";
import ProCalculator from "@/components/pro/ProCalculator";
import StartInfinityButton from "@/components/pro/StartInfinityButton";
import InfinityPlanPicker from "@/components/pro/InfinityPlanPicker";
import InfinityPreview, { type PreviewPiece } from "@/components/pro/InfinityPreview";
import { displayHost } from "@/components/share/shareData";
import { getUserFromCookie } from "@/lib/auth";
import { basePrices } from "@/lib/artwork_price";
import { paysForItself } from "@/lib/billingStatus";
import { calcItemProfitCents } from "@/lib/revenue";
import { money } from "@/lib/earnings";
import { getSales } from "@/app/studio/_lib/data";
import { FREE_SPLIT, PRO, REFERRALS, dollars, pct, planFeatures, proPrice, proYearlyPrice, yearlySavingsCents, type Feature } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pricing",
  description: `Free to sell, ${pct(FREE_SPLIT)} of profit. Infinity is ${proPrice()} a month or ${proYearlyPrice()} a year: ${pct(PRO.split)} of profit, auto videos and automations.`,
};

function Cell({ v, dark = false }: { v: Feature["free"]; dark?: boolean }) {
  if (v === false) return <Minus className={`h-4 w-4 shrink-0 ${dark ? "text-white/75" : "text-ink-2"}`} aria-label="Not included" />;
  return <Check className={`h-4 w-4 shrink-0 ${dark ? "text-sticker" : "text-earned"}`} aria-label="Included" />;
}

function FeatureList({ which, dark = false }: { which: "free" | "pro"; dark?: boolean }) {
  // Infinity lists what it adds; Free lists everything, with Infinity-only rows marked by a dash and "Infinity only"
  // (full-contrast text, not faded, for WCAG 4.5:1).
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
  ["How am I billed?", `${proPrice()} a month, or ${proYearlyPrice()} a year${yearlySavingsCents() > 0 ? ` (save ${dollars(yearlySavingsCents())})` : ""}, by card through Stripe, plus sales tax where it applies. Change your card or download invoices anytime from Manage billing in your Studio.`],
  ["Can I cancel?", "Anytime, from Manage billing. Infinity runs to the end of the period you paid for, then you’re on Free. No partial refunds."],
  ["What happens to my split if I go back to Free?", `New orders pay ${pct(FREE_SPLIT)}. Your art, page, codes and links all stay.`],
  ["Do old orders change?", "No. Every order keeps the split from the moment it was placed."],
  ["How do I get Infinity free?", `Share your link. Each artist who joins, gets a piece live and prints a code or makes a sale gives you ${REFERRALS.rewardMonths} months, up to ${REFERRALS.maxBankedMonths} banked.`],
  ["Do free months stack with a subscription?", "Yes. Subscribe while you have free months and the first charge waits until they run out. Months earned later push your next charge back."],
];

/** A signed-in artist's last 30 days, so the calculator starts from their own sales. Null when signed out. */
async function myNumbers() {
  const user = await getUserFromCookie().catch(() => null);
  if (!user?.id) return null;
  const artist = await prisma.artist.findUnique({ where: { id: user.id }, select: { id: true, closedAt: true } });
  if (!artist || artist.closedAt) return null;
  const sales = await getSales(artist.id, new Date(Date.now() - 30 * 86400000));
  const prints = sales.reduce((n, s) => n + s.quantity, 0);
  const avg = prints ? Math.round(sales.reduce((n, s) => n + s.priceCents, 0) / prints / 100) : 60;
  const worth = paysForItself(
    sales.slice().reverse().map((s) => ({
      quantity: s.quantity,
      profitCents: calcItemProfitCents({ lineTotal: s.priceCents, size: s.size, frameChosen: s.framed, quantity: s.quantity, orderDate: s.date }).profit,
    })),
  );
  return { prints, avg, worth };
}

export default async function PricingPage() {
  const [art, mine] = await Promise.all([
    prisma.artwork.findMany({
      where: { ...PUBLIC_ART, sensitive: { isEmpty: true } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { slug: true, title: true, imageUrl: true, markupSmall: true, artist: { select: { slug: true, name: true, artist_name: true } } },
    }),
    myNumbers(),
  ]);
  // The tallest of the three hero pieces stars in the video preview.
  const star = art[1] ?? art[0];
  const piece: PreviewPiece | null = star?.slug && star.artist?.slug
    ? { slug: star.slug, title: star.title, fromCents: basePrices.small + (star.markupSmall ?? 0), artist: displayName(star.artist), handle: star.artist.slug }
    : null;
  const host = displayHost(process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com");

  return (
    <>
      <section className="mx-auto grid max-w-[1240px] items-end gap-8 px-4 pb-10 pt-10 sm:px-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:pt-16">
        <div>
          <h1 className="display max-w-[12ch] text-[52px] sm:text-[84px]">Free to sell. <Brushed>Infinity</Brushed> to grow.</h1>
          <p className="mt-5 text-[17px] text-ink-2 [text-wrap:balance]">
            Keep {pct(FREE_SPLIT)} of the profit on Free, or {pct(PRO.split)} on {PRO.name} for {proPrice()} a month.
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
            <h2 className="t-card">Free</h2>
            <p className="t-num">$0</p>
            <p className="t-muted">Everything you need to sell.</p>
          </div>
          <Link href="/register" className="btn btn-blue btn-lg w-full">Start selling free</Link>
          <FeatureList which="free" />
        </div>

        <div className="relative grid content-start gap-5 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-ink p-5 text-white sm:p-7">
          <BrushStroke className="pointer-events-none absolute -right-10 -top-1 h-10 w-64 rotate-[-4deg]" color="var(--af-sticker)" />
          <div className="relative grid gap-1">
            <h2 className="t-card !text-white">Infinity plan</h2>
            <p className="t-muted !text-white/75">{pct(PRO.split)} of profit, plus auto videos and automations.</p>
          </div>
          <InfinityPlanPicker />
          <div className="relative -mt-3 grid">
            <Link href="/studio/infinity#referrals" className="text-center text-[14px] font-bold text-white underline-offset-2 hover:underline">Or share Artfinity, get {REFERRALS.rewardMonths} months free</Link>
          </div>
          <div className="relative"><FeatureList which="pro" dark /></div>
        </div>
      </section>

      {/* what Infinity adds, shown */}
      <section aria-labelledby="see-h" className="mx-auto grid max-w-[1240px] gap-6 px-4 pb-16 sm:px-6">
        <h2 id="see-h" className="t-feature">See what {PRO.name} does</h2>
        <InfinityPreview piece={piece} host={host} />
      </section>

      {/* calculator */}
      <section id="calculator" aria-labelledby="calc-h" className="scroll-mt-20 border-y border-line bg-wall">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-14 sm:px-6 md:py-20">
          <header className="grid gap-3">
            <h2 id="calc-h" className="t-feature">Is Infinity worth it for you?</h2>
            {mine && (
              mine.worth.prints === 0 ? (
                <p className="t-muted">No sales in your last 30 days yet. Try the sliders with the numbers you expect.</p>
              ) : (
                <p className={mine.worth.pays ? "w-fit rounded-xl border-[1.5px] border-earned bg-earned-soft px-4 py-3 text-[16px] font-semibold" : "w-fit rounded-xl border border-line bg-white px-4 py-3 text-[16px] font-semibold"}>
                  {mine.worth.pays
                    ? `Your last 30 days: ${mine.worth.prints} ${mine.worth.prints === 1 ? "print" : "prints"}. On ${PRO.name} you'd have kept ${money(mine.worth.netCents)} more, after the ${proPrice()}.`
                    : `Your last 30 days: ${mine.worth.prints} ${mine.worth.prints === 1 ? "print" : "prints"}. ${PRO.name} would have cost ${money(-mine.worth.netCents)} more than it paid back. Free is the better fit for now.`}
                </p>
              )
            )}
          </header>
          <div className="box p-4 sm:p-7">
            {mine && mine.prints > 0 && <p className="t-small mb-4">The sliders start from your last 30 days.</p>}
            <ProCalculator {...(mine && mine.prints > 0 ? { initialPrints: Math.min(100, mine.prints), initialPrice: Math.max(45, Math.min(200, mine.avg)) } : {})} />
          </div>
        </div>
      </section>

      {/* faq */}
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
        <div className="flex flex-wrap gap-2">
          <Link href="/register" className="btn btn-blue btn-lg">Start selling free</Link>
          <StartInfinityButton className="btn btn-ghost btn-lg" />
        </div>
      </section>
    </>
  );
}
