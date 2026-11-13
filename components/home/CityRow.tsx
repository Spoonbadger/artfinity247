import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";

export type CityCard = { slug: string; name: string; pieces: number; art: { slug: string; title: string; imageUrl: string }[] };

const STROKES = ["var(--af-sticker)", "var(--af-scan)", "var(--af-coral)", "var(--af-earned)"];
const HANG = ["left-[10%] top-[16%] w-[36%] -rotate-[2deg]", "left-[54%] top-[10%] w-[34%] rotate-[1.5deg]"];

/** Compact city cards: a patch of local wall with two real pieces on it. */
export default function CityRow({ cities }: { cities: CityCard[] }) {
  if (!cities.length) return null;
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4 lg:gap-6 [scrollbar-width:none]">
      {cities.map((c, i) => (
        <li key={c.slug} className="w-[72%] shrink-0 snap-start sm:w-auto">
          <Link href={`/scenes/${c.slug}`} className="group grid gap-2.5 text-ink no-underline">
            <span className="relative block aspect-[16/11] overflow-hidden rounded-md bg-wall">
              <BrushStroke className="absolute -left-6 top-[56%] h-[16%] w-[80%] -rotate-[4deg] opacity-50 transition-transform duration-700 group-hover:translate-x-3" color={STROKES[i % 4]} />
              {c.art.slice(0, 2).map((a, k) => (
                <span key={a.slug} className={cn("absolute aspect-[4/5] bg-white p-[3px] shadow-[0_10px_18px_-8px_rgba(21,22,27,.45)] transition duration-500 group-hover:-translate-y-1", HANG[k])}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                </span>
              ))}
              <span className="absolute inset-x-0 bottom-0 h-[12%] bg-[#dcd6ca]" aria-hidden="true" />
            </span>
            <span className="flex items-baseline justify-between gap-3 px-0.5">
              <b className="t-section truncate group-hover:text-scan">{c.name}</b>
              <span className="t-small num shrink-0">{c.pieces} pieces <ArrowRight className="inline h-3.5 w-3.5" aria-hidden="true" /></span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
