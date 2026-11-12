import type { Metadata } from "next";
import Link from "next/link";
import { BrushStroke } from "@/components/af/Brush";
import PageHead, { EmptyCanvas } from "@/components/browse/PageHead";
import SensitiveImage from "@/components/site/SensitiveImage";
import { getArt, getCities } from "@/components/browse/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Art by neighborhood and city", description: "Prints by independent artists, sorted by neighborhood and city." };

const STROKES = ["var(--af-sticker)", "var(--af-scan)", "var(--af-coral)", "var(--af-earned)"];
const HANG = ["left-[8%] top-[18%] w-[27%] -rotate-[2deg]", "left-[38%] top-[10%] w-[25%] rotate-[1deg]", "left-[67%] top-[22%] w-[24%] -rotate-[1deg]"];

export default async function ScenesPage() {
  const cities = await getCities();
  const withArt = await Promise.all(cities.map(async (c) => ({ ...c, art: (await getArt({ city: c.slug, perPage: 12 })).art.sort((a, b) => a.sensitive.length - b.sensitive.length).slice(0, 3) })));

  return (
    <div className="pb-20">
      <PageHead eyebrow="Local art" title="Neighborhoods" sub="By neighborhood and city. See what artists near you are painting." stroke="var(--af-scan)" />
      <section className="mx-auto mt-2 max-w-[1240px] px-4 sm:px-6" aria-label="Neighborhoods">
        {withArt.length ? (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
            {withArt.map((c, i) => (
              <Link key={c.slug} href={`/scenes/${c.slug}`} className="group grid content-start gap-3 text-ink no-underline">
                <div className="relative aspect-[16/11] overflow-hidden rounded-md bg-wall">
                  <BrushStroke className="absolute -left-6 top-[54%] h-[16%] w-[80%] -rotate-[4deg] opacity-50" color={STROKES[i % 4]} />
                  {c.art.map((a, k) => (
                    <div key={a.id} className={cn("absolute aspect-[4/5] bg-white shadow-[0_12px_22px_-8px_rgba(21,22,27,.45)] transition duration-500 group-hover:-translate-y-1", HANG[k])}>
                      {a.sensitive.length ? (
                        <SensitiveImage labels={a.sensitive} light>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                        </SensitiveImage>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </div>
                  ))}
                  <div className="absolute inset-x-0 bottom-0 h-[12%] bg-[#dcd6ca]" aria-hidden="true" />
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="t-section truncate group-hover:text-scan">{c.name}</h2>
                  <span className="t-small num shrink-0">{c.pieces} {c.pieces === 1 ? "piece" : "pieces"} · {c.artists} {c.artists === 1 ? "artist" : "artists"}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyCanvas title="No neighborhoods yet">
            <Link href="/register" className="btn btn-blue">Be the first in your neighborhood</Link>
          </EmptyCanvas>
        )}
      </section>
    </div>
  );
}
