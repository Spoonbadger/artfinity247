import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BrushStroke, Brushed } from "@/components/af/Brush";
import { DabRow } from "@/components/browse/PageHead";
import { PUBLIC_ART } from "@/components/browse/data";
import SensitiveImage from "@/components/site/SensitiveImage";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "About", description: "Artfinity turns the walls artists already hang on into shops." };

const BELIEFS: [string, string, string][] = [
  ["var(--af-earned)", "Artists first", "Free to join. 60% of the profit. Paid monthly."],
  ["var(--af-scan)", "Real walls", "Cafés, markets, shows. A code beside the piece does the selling."],
  ["var(--af-sticker)", "Made to order", "Every print is made when someone buys it. No waste, no stock."],
];

// Salon hang: positions for up to 7 pieces on the wall.
const HANG = [
  "left-[3%] top-[14%] w-[17%] -rotate-1",
  "left-[23%] top-[6%] w-[13%] rotate-1",
  "left-[23%] top-[52%] w-[13%] -rotate-[0.5deg]",
  "left-[39%] top-[10%] w-[22%]",
  "left-[64%] top-[8%] w-[12%] rotate-[1.5deg]",
  "left-[64%] top-[50%] w-[12%] -rotate-1",
  "left-[79%] top-[16%] w-[18%] rotate-[0.5deg]",
];

export default async function AboutPage() {
  const art = await prisma.artwork.findMany({
    where: { ...PUBLIC_ART, status: "APPROVED", sensitive: { isEmpty: true } },
    orderBy: { createdAt: "desc" },
    take: 24,
    select: { slug: true, title: true, imageUrl: true, sensitive: true, artistId: true },
  });
  // one piece per artist first, so the wall shows range
  const seen = new Set<string>();
  const wall = [...art.filter((a) => !seen.has(a.artistId) && seen.add(a.artistId)), ...art].filter((a, i, all) => all.findIndex((b) => b.slug === a.slug) === i).slice(0, 7);

  return (
    <>
      <section className="mx-auto max-w-[1240px] px-4 pb-10 pt-10 sm:px-6 md:pt-16">
        <div className="mb-4 flex items-center gap-2.5"><DabRow /><span className="eyebrow">About Artfinity</span></div>
        <h1 className="display max-w-[12ch] text-[56px] sm:text-[88px]">Local art, on <Brushed>every wall.</Brushed></h1>
        <p className="mt-5 max-w-[36ch] text-[19px] text-ink-2 sm:text-[21px]">We turn the walls artists already hang on into shops.</p>
      </section>

      {wall.length > 0 && (
        <section aria-label="Art from Artfinity artists" className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[22px] bg-gallery sm:aspect-[16/7]">
            <BrushStroke className="absolute -left-10 top-[38%] h-[14%] w-[70%] -rotate-3 opacity-40" color="var(--af-sticker)" />
            {wall.map((a, i) => (
              <Link key={a.slug} href={`/art/${a.slug}`} className={cn("absolute aspect-[4/5] bg-white p-[0.6%] shadow-[0_14px_26px_-10px_rgba(21,22,27,.5)] transition hover:-translate-y-1", HANG[i])}>
                {a.sensitive.length ? (
                  <SensitiveImage labels={a.sensitive} light>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                  </SensitiveImage>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                )}
              </Link>
            ))}
            <div className="absolute inset-x-0 bottom-0 h-[11%] bg-[#d7d1c4]" aria-hidden="true" />
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <ul className="grid gap-10 md:grid-cols-3 md:gap-8">
          {BELIEFS.map(([c, t, s]) => (
            <li key={t} className="grid content-start gap-2 border-t-[3px] border-ink pt-5">
              <span className="paint-dab mb-1 h-5 w-5" style={{ ["--dab" as string]: c }} aria-hidden="true" />
              <h2 className="display text-[36px]">{t}</h2>
              <p className="text-[17px] text-ink-2">{s}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-line bg-wall">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-6 px-4 py-14 sm:px-6">
          <div>
            <h2 className="display text-[40px] sm:text-[52px]">Made in Brooklyn, NY.</h2>
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
