import Link from "next/link";
import Marquee from "@/components/motion/Marquee";
import { money } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { artPath } from "@/lib/urls";

export type SalonArt = { slug: string; handle: string; title: string; imageUrl: string; artist: string; priceFrom: number };

// Salon hang rhythm: frame size and drop vary piece to piece.
const HANG = [
  "w-[150px] sm:w-[190px] mt-2",
  "w-[118px] sm:w-[150px] mt-10",
  "w-[136px] sm:w-[172px] mt-0",
  "w-[112px] sm:w-[140px] mt-14",
  "w-[146px] sm:w-[184px] mt-5",
];
const TILT = ["-rotate-1", "rotate-1", "rotate-0", "-rotate-[0.6deg]", "rotate-[0.8deg]"];

/** A wall of real pieces drifting by. Pauses on hover and focus; each piece links to its print page. */
export default function SalonStrip({ art, seconds = 70, reverse = false, label = "Popular prints" }: { art: SalonArt[]; seconds?: number; reverse?: boolean; label?: string }) {
  if (!art.length) return null;
  return (
    <Marquee seconds={seconds} reverse={reverse} label={label} className="relative">
      <ul className="flex items-start gap-6 pr-6 sm:gap-9 sm:pr-9">
        {art.map((a, i) => (
          <li key={a.slug} className={cn("shrink-0", HANG[i % HANG.length])}>
            <Link href={artPath(a.handle, a.slug)} className="group grid gap-2 text-ink no-underline">
              <span className={cn("block bg-white p-[6px] shadow-[0_2px_0_rgba(21,22,27,.06),0_16px_26px_-12px_rgba(21,22,27,.5)] transition duration-500 group-hover:-translate-y-1.5 group-focus-visible:-translate-y-1.5", TILT[i % TILT.length])}>
                <span className="block aspect-[4/5] overflow-hidden bg-wall">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" decoding="async" />
                </span>
              </span>
              <span className="grid gap-0.5 px-0.5">
                <b className="truncate text-[13.5px] leading-tight group-hover:text-scan">{a.title}</b>
                <span className="truncate text-[12.5px] text-ink-2">{a.artist}</span>
                <span className="num text-[12.5px] font-semibold">from {money(a.priceFrom)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Marquee>
  );
}
