import Link from "next/link";
import { headers } from "next/headers";
import SensitiveImage from "@/components/site/SensitiveImage";
import { money } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { artistPath, artPath } from "@/lib/urls";
import type { CardArt } from "./data";
import { InlineBadges } from "@/components/artist/TrustBlock";
import { getTrustBySlug, type Trust } from "@/lib/artistTrust";
import EditionBadge from "@/components/art/EditionBadge";
import { editionsFor } from "@/lib/editions";
import type { Edition } from "@/lib/editionFormat";
import WishlistHeart from "@/components/collector/WishlistHeart";
import Masonry from "./Masonry";

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

/** The art at its own proportions, edge to edge (masonry tiles). Sensitive pieces stay blurred until shown. */
function NaturalArt({ src, alt, sensitive, priority = false }: { src: string; alt: string; sensitive?: string[] | null; priority?: boolean }) {
  const picture = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="block h-auto min-h-[120px] w-full bg-wall object-cover transition duration-500 group-hover:scale-[1.03]"
    />
  );
  return sensitive?.length ? <SensitiveImage labels={sensitive}>{picture}</SensitiveImage> : picture;
}

/** A piece hung on a little patch of gallery wall. Card → /@handle/art/[slug], artist → /@handle. */
export default function ArtCard({ art, className, priority = false, showPrice = true, trust, edition, natural = false }: { art: CardArt; className?: string; priority?: boolean; showPrice?: boolean; trust?: Trust | null; edition?: Edition | null; natural?: boolean }) {
  return (
    <article className={cn("art-tile group relative grid min-w-0 content-start gap-2.5", className)}>
      {natural ? (
        // Masonry tile: the piece at its own shape, full width, with a slow, slight zoom on hover
        <Link href={artPath(art.artist.slug, art.slug)} className="relative block overflow-hidden rounded-md bg-wall" aria-label={`${art.title} by ${art.artist.name}`}>
          <NaturalArt src={art.imageUrl} alt={art.title} sensitive={art.sensitive} priority={priority} />
          <EditionBadge edition={edition} compact className="absolute left-2 top-2" />
        </Link>
      ) : (
        <Link href={artPath(art.artist.slug, art.slug)} className="relative block aspect-[4/5] overflow-hidden rounded-md bg-wall" aria-label={`${art.title} by ${art.artist.name}`}>
          <HungArt src={art.imageUrl} alt={art.title} sensitive={art.sensitive} priority={priority} />
          <EditionBadge edition={edition} compact className="absolute left-2 top-2" />
        </Link>
      )}
      <WishlistHeart artworkId={art.id} title={art.title} className="absolute right-2 top-2" />
      <div className="grid min-w-0 gap-0.5 px-0.5">
        <Link href={artPath(art.artist.slug, art.slug)} className="truncate text-[15px] font-semibold leading-snug text-ink no-underline hover:text-scan">{art.title}</Link>
        <div className="grid min-w-0 gap-x-2 text-[13.5px] sm:flex sm:items-baseline sm:justify-between">
          <span className="flex min-w-0 items-center gap-1">
            <Link href={artistPath(art.artist.slug)} className="truncate text-ink-2 no-underline hover:text-ink hover:underline">{art.artist.name}</Link>
            <InlineBadges trust={trust} size={14} />
          </span>
          {showPrice && <span className="num shrink-0 text-ink-2">from <b className="font-semibold text-ink">{money(art.priceFrom)}</b></span>}
        </div>
      </div>
    </article>
  );
}

/** Server component: one batched trust lookup for the whole grid, so artist names carry their badges. */
export async function ArtGrid({ art, className }: { art: CardArt[]; className?: string }) {
  const [trust, editions] = await Promise.all([
    getTrustBySlug(art.map((a) => a.artist.slug)),
    editionsFor(art.map((a) => ({ id: a.id, editionSize: a.editionSize ?? null }))),
  ]);
  // Masonry: each piece at its own shape. Phones start in two columns and desktops in four; the browser
  // corrects the guess for tablets before the first paint.
  const ua = headers().get("user-agent") || "";
  const phone = headers().get("sec-ch-ua-mobile") === "?1" || /Mobi|Android|iPhone|iPod/i.test(ua);
  return (
    <Masonry initialCols={phone ? 2 : 4} className={className}>
      {art.map((a, i) => <ArtCard key={a.id} art={a} priority={i < 4} trust={trust.get(a.artist.slug)} edition={editions.get(a.id)} natural />)}
    </Masonry>
  );
}
