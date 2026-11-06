import Link from "next/link";
import { Plus } from "lucide-react";
import SensitiveImage from "@/components/site/SensitiveImage";
import { cn } from "@/lib/utils";
import type { DirArtist } from "./data";
import { InlineBadges } from "@/components/artist/TrustBlock";
import type { Trust } from "@/lib/artistTrust";

export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={cn("h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-white", className)} loading="lazy" />
  ) : (
    <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-bold text-white ring-2 ring-white", className)} aria-hidden="true">{name.trim()[0]?.toUpperCase()}</span>
  );
}

// Three pieces hung salon-style at slightly different heights and sizes.
const HANG: Record<number, string[]> = {
  1: ["left-[35%] top-[12%] w-[30%] -rotate-[1deg]"],
  2: ["left-[17%] top-[14%] w-[29%] -rotate-[1.5deg]", "left-[55%] top-[10%] w-[27%] rotate-[1deg]"],
  3: ["left-[7%] top-[16%] w-[30%] -rotate-[1.5deg]", "left-[40%] top-[9%] w-[24%] rotate-[1deg]", "left-[68%] top-[20%] w-[25%] -rotate-[0.5deg]"],
};

/** Directory card: a little wall of their newest work, then who they are. Links to /@slug. */
export default function ArtistCard({ artist, trust }: { artist: DirArtist; trust?: Trust | null }) {
  return (
    <Link href={`/@${artist.slug}`} className="group grid min-w-0 content-start gap-3.5 text-ink no-underline">
      <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-wall">
        {artist.art.slice(0, 3).map((a, i) => (
          <div key={a.slug} className={cn("absolute aspect-[4/5] bg-white shadow-[0_12px_22px_-8px_rgba(21,22,27,.45)] transition duration-500 group-hover:-translate-y-1", HANG[Math.min(3, artist.art.length)][i])} style={{ transitionDelay: `${i * 40}ms` }}>
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
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={artist.avatar} name={artist.name} />
        <div className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <b className="t-card truncate group-hover:text-scan">{artist.name}</b>
            <InlineBadges trust={trust} size={17} />
          </span>
          <span className="t-small block truncate">{artist.city}{artist.city ? " · " : ""}<span className="num">{artist.count}</span> {artist.count === 1 ? "piece" : "pieces"}</span>
        </div>
      </div>
      {artist.bio && <p className="t-muted line-clamp-2">{artist.bio}</p>}
    </Link>
  );
}

/** The empty spot on the wall: an invitation to join. */
export function YourSpotCard({ className }: { className?: string }) {
  return (
    <Link href="/register" className={cn("group grid min-w-0 content-start gap-3.5 text-ink no-underline", className)}>
      <div className="relative grid aspect-[16/10] place-items-center overflow-hidden rounded-md border-2 border-dashed border-ink/30 bg-white transition group-hover:border-scan">
        <div className="grid justify-items-center gap-2 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-sticker transition group-hover:scale-110"><Plus className="h-6 w-6" aria-hidden="true" /></span>
          <b className="display text-[28px]">Your wall here</b>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="h-11 w-11 shrink-0 rounded-full border-2 border-dashed border-ink/30" aria-hidden="true" />
        <div>
          <b className="t-card block group-hover:text-scan">Start selling free</b>
          <span className="t-small block">Takes about a minute.</span>
        </div>
      </div>
    </Link>
  );
}
