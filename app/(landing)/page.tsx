import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { breakdown } from "@/lib/earnings";
import { basePrices } from "@/lib/artwork_price";
import { BrushStroke, Brushed } from "@/components/af/Brush";
import { HungArt } from "@/components/browse/ArtCard";
import { InlineBadges } from "@/components/artist/TrustBlock";
import { getTrustBySlug } from "@/lib/artistTrust";
import ClaimHandle from "@/components/home/ClaimHandle";
import CodeNote from "@/components/qr/CodeNote";
import HeroStory from "@/components/home/HeroStory";
import SalonStrip from "@/components/home/SalonStrip";
import CityRow from "@/components/home/CityRow";
import BrushWipe from "@/components/motion/BrushWipe";
import Splat from "@/components/motion/Splat";
import HowItWorks from "@/components/home/HowItWorks";
import EarningsCalculator from "@/components/home/EarningsCalculator";
import { DabRow } from "@/components/browse/PageHead";
import { getArtists, getCities, displayName, PUBLIC_ART } from "@/components/browse/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Artfinity · Every wall is a shop" } };

async function getHeroArt() {
  const select = { artistId: true, slug: true, title: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, artist: { select: { name: true, artist_name: true, slug: true } } } as const;
  // The best-selling safe-for-work piece; falls back to the newest one.
  const top =
    (await prisma.artwork.findFirst({ where: { ...PUBLIC_ART, status: "APPROVED", sensitive: { isEmpty: true } }, orderBy: [{ OrderItem: { _count: "desc" } }, { createdAt: "asc" }], select })) ??
    (await prisma.artwork.findFirst({ where: PUBLIC_ART, orderBy: { createdAt: "desc" }, select }));
  return top;
}

const SAFE = { ...PUBLIC_ART, sensitive: { isEmpty: true } };

/** Most-sold approved, safe-for-work pieces for the drifting wall. */
async function getPopular() {
  const rows = await prisma.artwork.findMany({
    where: SAFE,
    orderBy: [{ OrderItem: { _count: "desc" } }, { createdAt: "desc" }],
    take: 14,
    select: { slug: true, title: true, imageUrl: true, markupSmall: true, artist: { select: { name: true, artist_name: true } } },
  });
  return rows.map((a) => ({ slug: a.slug!, title: a.title, imageUrl: a.imageUrl, artist: displayName(a.artist), priceFrom: basePrices.small + (a.markupSmall ?? 0) }));
}

/** The biggest few cities, each with two real pieces. */
async function getCityCards() {
  const cities = (await getCities()).slice(0, 4);
  return Promise.all(
    cities.map(async (c) => ({
      slug: c.slug, name: c.name, pieces: c.pieces,
      art: (await prisma.artwork.findMany({ where: { ...SAFE, artist: { citySlug: c.slug } }, orderBy: { createdAt: "desc" }, take: 2, select: { slug: true, title: true, imageUrl: true } })).map((a) => ({ ...a, slug: a.slug! })),
    })),
  );
}

/** Prints the hero artist sold in the last 30 days, for the earnings chip. */
async function printsThisMonth(artistId: string) {
  const since = new Date(Date.now() - 30 * 864e5);
  const r = await prisma.orderItem.aggregate({ _sum: { quantity: true }, where: { artwork: { artistId }, order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: since } } } });
  return r._sum.quantity ?? 0;
}

export default async function Home({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const [hero, artists, popular, cities] = await Promise.all([getHeroArt(), getArtists({ take: 4, pieces: 1 }), getPopular(), getCityCards()]);
  const trust = await getTrustBySlug(artists.map((a) => a.slug));
  const perPrint = hero ? breakdown("medium", hero.markupMedium ?? 0).artist : breakdown("medium", 1500).artist;
  const smallPerPrint = hero ? breakdown("small", hero.markupSmall ?? 0).artist : breakdown("small", 1000).artist;
  const price = breakdown("medium", hero?.markupMedium ?? 1500).price;
  const monthBefore = hero ? Math.max(1, await printsThisMonth(hero.artistId)) * perPrint : 0;
  const heroArt = hero
    ? { slug: hero.slug!, title: hero.title, imageUrl: hero.imageUrl, sensitive: hero.sensitive, artist: { name: displayName(hero.artist), slug: hero.artist.slug } }
    : null;

  return (
    <>
      {searchParams?.code === "unknown" && <CodeNote kind="unknown" />}
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-16">
          <div className="min-w-0">
            <span className="sticker-badge">Free for artists. Always.</span>
            <h1 className="display mt-5 text-[58px] sm:text-[84px] lg:text-[96px]">
              Turn every wall into <Brushed color="var(--af-sticker)"><span className="text-scan">your shop.</span></Brushed>
            </h1>
            <p className="mt-5 text-[19px] leading-snug text-ink-2 sm:text-[21px]">They scan. We print. You get paid.</p>
            <ClaimHandle className="mt-7" />
            <p className="mt-3 pl-4 text-[14px] text-ink-2">
              Just here for art? <Link href="/art" className="font-semibold text-ink underline-offset-2 hover:underline">Browse prints <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" /></Link>
            </p>
          </div>
          {heroArt && <HeroStory art={heroArt} perPrint={perPrint} price={price} monthBefore={monthBefore} />}
        </div>
      </section>

      {/* HOW IT WORKS */}
      {heroArt && <HowItWorks art={heroArt} perPrint={perPrint} smallPerPrint={smallPerPrint} monthBefore={monthBefore} />}

      {/* ON WALLS NOW: popular prints, drifting by */}
      {popular.length > 0 && (
        <section className="relative overflow-hidden border-t border-line bg-gallery py-14 md:py-20" aria-labelledby="popular-h">
          <div className="mx-auto mb-8 flex max-w-[1240px] flex-wrap items-end justify-between gap-4 px-4 sm:px-6 md:mb-10">
            <h2 id="popular-h" className="display text-[44px] sm:text-[60px]">On walls now</h2>
            <Link href="/art" className="btn btn-ghost bg-white">Browse all prints</Link>
          </div>
          <SalonStrip art={popular} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-[#d7d1c4] md:h-12" aria-hidden="true"><div className="h-[3px] bg-[#c9c2b3]" /></div>
        </section>
      )}

      {/* EARNINGS */}
      <section className="relative overflow-hidden border-b border-line bg-wall">
        <BrushStroke className="pointer-events-none absolute -right-24 top-10 hidden h-16 w-[420px] md:block rotate-[-4deg] opacity-30" color="var(--af-earned)" />
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-6 flex items-center gap-3"><Splat><DabRow colors={["var(--af-earned)", "var(--af-sticker)", "var(--af-earned)"]} /></Splat><span className="eyebrow">Do the math</span></div>
          <h2 className="display mb-10 max-w-[14ch] text-[44px] sm:text-[60px] md:mb-12">What could one piece earn?</h2>
          <EarningsCalculator />
        </div>
      </section>

      {/* CITIES */}
      {cities.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-4 pt-16 sm:px-6 md:pt-24" aria-labelledby="cities-h">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <h2 id="cities-h" className="display relative inline-block text-[44px] sm:text-[60px]">
              <span className="relative z-10">Browse by city</span>
              <BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-scan)" style={{ opacity: 0.35 }} />
            </h2>
            <Link href="/scenes" className="btn btn-ghost">All cities</Link>
          </div>
          <CityRow cities={cities} />
        </section>
      )}

      {/* ARTISTS */}
      {artists.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
            <h2 className="display max-w-[16ch] text-[44px] sm:text-[60px]">Hanging codes now</h2>
            <Link href="/artists" className="btn btn-ghost">See all artists</Link>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-7">
            {artists.map((a, i) => {
              const art = a.art[0];
              return (
                <Link key={a.slug} href={`/@${a.slug}`} className="group grid min-w-0 content-start gap-3 text-ink no-underline">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-wall">
                    {art && <HungArt src={art.imageUrl} alt={art.title} sensitive={art.sensitive} />}
                    <span className="paint-dab absolute right-3 top-3 h-4 w-4" style={{ ["--dab" as string]: ["var(--af-sticker)", "var(--af-scan)", "var(--af-coral)", "var(--af-earned)"][i % 4] }} aria-hidden="true" />
                  </div>
                  <div className="flex min-w-0 items-center gap-2.5">
                    {a.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.avatar} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-[15px] font-bold text-white">{a.name[0]}</span>
                    )}
                    <div className="min-w-0">
                      <b className="block truncate text-[15px] group-hover:text-scan">{a.name}</b>
                      <span className="block truncate text-[13px] text-ink-2">{a.city}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden bg-ink text-white">
        <BrushWipe className="pointer-events-none absolute -left-16 bottom-0 h-14 w-[520px] rotate-[3deg] opacity-25 md:bottom-6 md:h-20" color="var(--af-scan)" />
        <BrushWipe className="pointer-events-none absolute -right-20 top-8 h-12 w-[380px] -rotate-[5deg] opacity-30" color="var(--af-sticker)" delay={0.4} />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <h2 className="display text-[48px] text-white sm:text-[68px]">Your next wall could pay you.</h2>
          <ClaimHandle dark className="lg:justify-self-end" />
        </div>
      </section>
    </>
  );
}
