import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BrushStroke, Brushed } from "@/components/af/Brush";
import { DabRow } from "@/components/browse/PageHead";
import { PUBLIC_ART, displayName } from "@/components/browse/data";
import { basePrices } from "@/lib/artwork_price";
import SalonStrip from "@/components/home/SalonStrip";
import Splat from "@/components/motion/Splat";
import BrushWipe from "@/components/motion/BrushWipe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About", description: "Artfinity turns the walls artists already hang on into shops." };

const BELIEFS: [string, string, string][] = [
  ["var(--af-earned)", "Artists first", "Free to join. 60% of the profit."],
  ["var(--af-scan)", "Real walls", "Cafés, markets, shows."],
  ["var(--af-sticker)", "Made to order", "No waste. No stock."],
];

export default async function AboutPage() {
  const art = await prisma.artwork.findMany({
    where: { ...PUBLIC_ART, status: "APPROVED", sensitive: { isEmpty: true } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { slug: true, title: true, imageUrl: true, artistId: true, markupSmall: true, artist: { select: { name: true, artist_name: true } } },
  });
  // one piece per artist first, so the wall shows range
  const seen = new Set<string>();
  const wall = [...art.filter((a) => !seen.has(a.artistId) && seen.add(a.artistId)), ...art].filter((a, i, all) => all.findIndex((b) => b.slug === a.slug) === i)
    .map((a) => ({ slug: a.slug!, title: a.title, imageUrl: a.imageUrl, artist: displayName(a.artist), priceFrom: basePrices.small + (a.markupSmall ?? 0) }));
  const half = Math.ceil(wall.length / 2);

  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-10 pt-10 sm:px-6 md:pt-16">
        <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">About Artfinity</span></div>
        <h1 className="display max-w-[12ch] text-[56px] sm:text-[88px]">Local art, on <Brushed>every wall.</Brushed></h1>
        <p className="mt-5 max-w-[36ch] text-[19px] text-ink-2 sm:text-[21px]">The walls artists already hang on, turned into shops.</p>
      </section>

      {wall.length > 0 && (
        <section aria-label="Art from Artfinity artists" className="relative overflow-hidden border-y border-line bg-gallery py-10 md:py-14">
          <BrushStroke className="pointer-events-none absolute -left-10 top-[42%] h-16 w-[70%] -rotate-3 opacity-40" color="var(--af-sticker)" />
          <div className="relative grid gap-8 md:gap-10">
            <SalonStrip art={wall.slice(0, half)} seconds={80} label="Prints by Artfinity artists" />
            <SalonStrip art={wall.slice(half)} seconds={95} reverse label="More prints by Artfinity artists" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-[#d7d1c4]" aria-hidden="true" />
        </section>
      )}

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <ul className="grid gap-10 md:grid-cols-3 md:gap-8">
          {BELIEFS.map(([c, t, s]) => (
            <li key={t} className="grid content-start gap-2 border-t-[3px] border-ink pt-5">
              <Splat><span className="paint-dab mb-1 h-5 w-5" style={{ ["--dab" as string]: c }} aria-hidden="true" /></Splat>
              <h2 className="display text-[36px]">{t}</h2>
              <p className="text-[17px] text-ink-2">{s}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line bg-wall">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6">
          <div>
            <h2 className="display relative inline-block text-[40px] sm:text-[52px]"><span className="relative z-10">Made in Brooklyn, NY.</span><BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-coral)" style={{ opacity: 0.45 }} /></h2>
            <p className="mt-1 text-[17px] text-ink-2">Shipped across the US.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/art" className="btn btn-ghost btn-lg">Browse art</Link>
            <Link href="/register" className="btn btn-blue btn-lg">Start selling free</Link>
          </div>
        </div>
      </section>
    </>
  );
}
