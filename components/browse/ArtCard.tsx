import Link from "next/link";
import SensitiveImage from "@/components/site/SensitiveImage";
import { money } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import type { CardArt } from "./data";

/** The art itself, hung on a patch of gallery wall. Fills its (positioned, sized) parent. */
export function HungArt({ src, alt, sensitive, priority = false }: { src: string; alt: string; sensitive?: string[] | null; priority?: boolean }) {
  // Only sensitive pieces get the blur wrapper (it clips, which would cut off the hanging shadow).
  const picture = (
    <div className="grid h-full w-full place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="max-h-full max-w-full bg-white object-contain shadow-[0_1px_0_rgba(21,22,27,.08),0_12px_24px_-6px_rgba(21,22,27,.35)] transition duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_1px_0_rgba(21,22,27,.08),0_20px_32px_-8px_rgba(21,22,27,.4)]"
      />
    </div>
  );
  return <div className="h-full w-full p-[10%]">{sensitive?.length ? <SensitiveImage labels={sensitive}>{picture}</SensitiveImage> : picture}</div>;
}

/** A piece hung on a little patch of gallery wall. Card → /art/[slug], artist → /@slug. */
export default function ArtCard({ art, className, priority = false, showPrice = true }: { art: CardArt; className?: string; priority?: boolean; showPrice?: boolean }) {
  return (
    <article className={cn("group grid min-w-0 content-start gap-2.5", className)}>
      <Link href={`/art/${art.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-md bg-wall" aria-label={`${art.title} by ${art.artist.name}`}>
        <HungArt src={art.imageUrl} alt={art.title} sensitive={art.sensitive} priority={priority} />
      </Link>
      <div className="grid min-w-0 gap-0.5 px-0.5">
        <Link href={`/art/${art.slug}`} className="truncate text-[15px] font-semibold leading-snug text-ink no-underline hover:text-scan">{art.title}</Link>
        <div className="grid min-w-0 gap-x-2 text-[13.5px] sm:flex sm:items-baseline sm:justify-between">
          <Link href={`/@${art.artist.slug}`} className="truncate text-ink-2 no-underline hover:text-ink hover:underline">{art.artist.name}</Link>
          {showPrice && <span className="num shrink-0 text-ink-2">from <b className="font-semibold text-ink">{money(art.priceFrom)}</b></span>}
        </div>
      </div>
    </article>
  );
}

export function ArtGrid({ art, className }: { art: CardArt[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-7 sm:gap-x-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-7 lg:gap-y-10", className)}>
      {art.map((a, i) => <ArtCard key={a.id} art={a} priority={i < 4} />)}
    </div>
  );
}
