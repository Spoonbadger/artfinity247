import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { breakdown } from "@/lib/earnings";
import { BrushStroke, Brushed } from "@/components/af/Brush";
import { HungArt } from "@/components/browse/ArtCard";
import ClaimHandle from "@/components/home/ClaimHandle";
import HeroWall from "@/components/home/HeroWall";
import HowItWorks from "@/components/home/HowItWorks";
import EarningsCalculator from "@/components/home/EarningsCalculator";
import { DabRow } from "@/components/browse/PageHead";
import { getArtists, displayName, PUBLIC_ART } from "@/components/browse/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { absolute: "Artfinity · Every wall is a shop" } };

async function getHeroArt() {
  const select = { slug: true, title: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, artist: { select: { name: true, artist_name: true, slug: true } } } as const;
  // The best-selling safe-for-work piece; falls back to the newest one.
  const top =
    (await prisma.artwork.findFirst({ where: { ...PUBLIC_ART, status: "APPROVED", sensitive: { isEmpty: true } }, orderBy: [{ OrderItem: { _count: "desc" } }, { createdAt: "asc" }], select })) ??
    (await prisma.artwork.findFirst({ where: PUBLIC_ART, orderBy: { createdAt: "desc" }, select }));
  return top;
}

const TRUST: [string, string, string][] = [
  ["var(--af-earned)", "60% of the profit", "Every price shows the math."],
  ["var(--af-sticker)", "No inventory", "Made to order. We ship it."],
  ["var(--af-scan)", "Checkout people know", "Card, Apple Pay, Google Pay."],
  ["var(--af-coral)", "Your name, your link", "theartfinity.com/@you"],
];

export default async function Home() {
  const [hero, artists] = await Promise.all([getHeroArt(), getArtists({ take: 4, pieces: 1 })]);
  const perPrint = hero ? breakdown("medium", hero.markupMedium ?? 0).artist : breakdown("medium", 1500).artist;
  const smallPerPrint = hero ? breakdown("small", hero.markupSmall ?? 0).artist : breakdown("small", 1000).artist;
  const heroArt = hero
    ? { slug: hero.slug!, title: hero.title, imageUrl: hero.imageUrl, sensitive: hero.sensitive, artist: { name: displayName(hero.artist), slug: hero.artist.slug } }
    : null;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-24 lg:pt-16">
          <div className="min-w-0">
            <span className="sticker-badge">Free for artists. Always.</span>
            <h1 className="display mt-5 text-[58px] sm:text-[84px] lg:text-[96px]">
              Turn every wall into <Brushed color="var(--af-sticker)"><span className="text-scan">your shop.</span></Brushed>
            </h1>
            <p className="mt-5 max-w-[30ch] text-[19px] leading-snug text-ink-2 sm:text-[21px]">Hang a QR code next to your art. People scan, we print, you get paid.</p>
            <ClaimHandle className="mt-7" />
            <p className="mt-3 pl-4 text-[14px] text-ink-2">
              Just here for art? <Link href="/art" className="font-semibold text-ink underline-offset-2 hover:underline">Browse prints <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" /></Link>
            </p>
          </div>
          {heroArt && <HeroWall art={heroArt} perPrint={perPrint} />}
        </div>
      </section>

      {/* HOW IT WORKS */}
      {heroArt && <HowItWorks art={heroArt} perPrint={perPrint} smallPerPrint={smallPerPrint} />}

      {/* EARNINGS */}
      <section className="relative overflow-hidden border-y border-line bg-wall">
        <BrushStroke className="pointer-events-none absolute -right-24 top-10 hidden h-16 w-[420px] md:block rotate-[-4deg] opacity-30" color="var(--af-earned)" />
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-10 flex items-center gap-3"><DabRow colors={["var(--af-earned)", "var(--af-sticker)", "var(--af-earned)"]} /><span className="eyebrow">Do the math</span></div>
          <h2 className="display mb-10 max-w-[14ch] text-[44px] sm:text-[60px] md:mb-12">What could one piece earn?</h2>
          <EarningsCalculator />
        </div>
      </section>

      {/* ARTISTS */}
      {artists.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 md:mb-10">
            <h2 className="display max-w-[16ch] text-[44px] sm:text-[60px]">Artists hanging codes right now</h2>
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

      {/* TRUST */}
      <section className="mx-auto max-w-[1240px] px-4 pb-16 sm:px-6 md:pb-24">
        <ul className="grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
          {TRUST.map(([c, t, s]) => (
            <li key={t} className="grid content-start gap-1.5 border-t-[3px] border-ink pt-4">
              <span className="paint-dab mb-1" style={{ ["--dab" as string]: c }} aria-hidden="true" />
              <b className="text-[16px] leading-tight">{t}</b>
              <span className="text-[14.5px] text-ink-2 [overflow-wrap:anywhere]">{s}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-ink text-white">
        <BrushStroke className="pointer-events-none absolute -left-16 bottom-0 h-14 w-[520px] rotate-[3deg] opacity-25 md:bottom-6 md:h-20" color="var(--af-scan)" />
        <BrushStroke className="pointer-events-none absolute -right-20 top-8 h-12 w-[380px] -rotate-[5deg] opacity-30" color="var(--af-sticker)" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <h2 className="display text-[48px] text-white sm:text-[68px]">Your next wall could pay you.</h2>
          <ClaimHandle dark className="lg:justify-self-end" />
        </div>
      </section>
    </>
  );
}
