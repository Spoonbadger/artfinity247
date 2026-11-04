import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import SensitiveImage from "@/components/site/SensitiveImage";
import EditionBadge from "@/components/art/EditionBadge";
import { BrushStroke } from "@/components/af/Brush";
import { getPublicCollection, type PublicWork } from "@/components/collections/data";
import { editionsFor } from "@/lib/editions";
import type { Edition } from "@/lib/editionFormat";
import { money } from "@/lib/earnings";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string; collection: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicCollection(params.slug, params.collection).catch(() => null);
  if (!data) return { title: "Collection" };
  const { artist, collection } = data;
  return {
    title: `${collection.title} by ${artist.name}`,
    description: collection.description || `${collection.works.length} works by ${artist.name}. Prints with free US shipping.`,
    alternates: { canonical: `/@${artist.slug}/collections/${collection.slug}` },
    openGraph: { title: `${collection.title} · ${artist.name}`, images: collection.cover ? [{ url: collection.cover.imageUrl, alt: collection.cover.title }] : undefined },
  };
}

// Salon hang: each piece gets one of a few frames, so the wall feels hung by hand.
const FRAMES = [
  "bg-white p-[7%] shadow-[0_18px_34px_-14px_rgba(21,22,27,.5),0_0_0_1px_rgba(21,22,27,.06)]",
  "bg-[#15161b] p-[3px] shadow-[0_18px_34px_-14px_rgba(21,22,27,.55)] [&_.mat]:bg-white [&_.mat]:p-[6%]",
  "bg-[#c8a477] p-[6px] shadow-[0_18px_34px_-14px_rgba(21,22,27,.5),inset_0_0_0_1px_rgba(0,0,0,.15)]",
  "bg-white p-[4px] shadow-[0_18px_34px_-14px_rgba(21,22,27,.5),0_0_0_1px_rgba(21,22,27,.08)]",
];
const TILT = ["rotate-[-0.6deg]", "rotate-[0.4deg]", "", "rotate-[0.8deg]", "rotate-[-0.3deg]"];
// Varied widths, hung left to right in the artist's order, centered like a salon wall.
const WIDTH = [
  "sm:w-[46%] lg:w-[36%]",
  "sm:w-[38%] lg:w-[26%]",
  "sm:w-[38%] lg:w-[28%]",
  "sm:w-[46%] lg:w-[24%]",
  "sm:w-[42%] lg:w-[32%]",
  "sm:w-[42%] lg:w-[30%]",
];
const DROP = ["", "lg:mt-16", "lg:mt-6", "", "lg:mt-10", "lg:mt-2"];

function Hung({ w, i, edition }: { w: PublicWork; i: number; edition: Edition | null }) {
  return (
    <li className={cn("w-full max-w-[340px] sm:max-w-none", WIDTH[i % WIDTH.length], DROP[i % DROP.length])}>
      <Link href={`/art/${w.slug}`} className="group block text-ink no-underline" aria-label={`${w.title}, from ${money(w.fromCents)}`}>
        <div className={cn("relative mx-auto w-fit transition duration-300 group-hover:-translate-y-1", TILT[i % TILT.length])}>
          {/* the hanging wire */}
          <span aria-hidden className="absolute -top-6 left-1/2 hidden h-6 w-24 -translate-x-1/2 sm:block">
            <svg viewBox="0 0 96 24" className="h-full w-full"><path d="M8 24 L48 2 L88 24" fill="none" stroke="rgba(21,22,27,.25)" strokeWidth="1" /><circle cx="48" cy="2" r="2" fill="rgba(21,22,27,.35)" /></svg>
          </span>
          <div className={FRAMES[i % FRAMES.length]}>
            <div className="mat">
              <SensitiveImage labels={w.sensitive}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={w.imageUrl} alt={w.title} loading={i < 4 ? "eager" : "lazy"} className="block h-auto max-h-[70vh] w-full object-contain" />
              </SensitiveImage>
            </div>
          </div>
        </div>
        {/* museum label */}
        <div className="mx-auto mt-4 flex w-fit max-w-full items-center gap-3 rounded-[2px] bg-white/80 px-3 py-1.5 shadow-[0_1px_0_rgba(21,22,27,.08)]">
          <span className="min-w-0 leading-tight">
            <b className="block truncate text-[14.5px] group-hover:underline">{w.title}</b>
            <span className="num text-[12.5px] text-ink-2">Prints from {money(w.fromCents)}</span>
          </span>
          <EditionBadge edition={edition} compact />
        </div>
      </Link>
    </li>
  );
}

function Neighbor({ dir, artistSlug, c }: { dir: "prev" | "next"; artistSlug: string; c: { slug: string; title: string; cover: PublicWork | null } }) {
  return (
    <Link
      href={`/@${artistSlug}/collections/${c.slug}`}
      className={cn("group flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-white p-2.5 text-ink no-underline transition hover:border-ink", dir === "next" && "flex-row-reverse text-right")}
    >
      {c.cover && (
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-gallery p-1.5">
          <SensitiveImage labels={c.cover.sensitive}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.cover.imageUrl} alt="" className="h-full w-full bg-white object-contain" />
          </SensitiveImage>
        </span>
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-2 [justify-content:inherit]">
          {dir === "prev" ? <><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Previous</> : <>Next<ArrowRight className="h-3.5 w-3.5" aria-hidden /></>}
        </span>
        <b className="block truncate font-display text-[20px] [font-variation-settings:'wdth'_80] group-hover:underline">{c.title}</b>
      </span>
    </Link>
  );
}

export default async function CollectionPage({ params }: Props) {
  const data = await getPublicCollection(params.slug, params.collection);
  if (!data) notFound();
  const { artist, collection, prev, next } = data;
  const editions = await editionsFor(collection.works.map((w) => ({ id: w.id, editionSize: w.editionSize })));
  const n = collection.works.length;

  return (
    <div className="bg-[#efece5] bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#ebe7df_55%,#e4dfd5_100%)] pb-16 sm:pb-24">
      <header className="mx-auto grid max-w-[1240px] gap-4 px-4 pb-8 pt-8 sm:px-6 sm:pb-12 sm:pt-14">
        <Link href={`/@${artist.slug}`} className="flex w-fit min-h-[44px] items-center gap-2.5 text-ink no-underline">
          <span className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-wall ring-2 ring-white">
            {artist.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artist.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center text-sm font-bold">{artist.name[0]}</span>
            )}
          </span>
          <span className="text-[15px] font-bold hover:underline">{artist.name}</span>
        </Link>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] md:items-end md:gap-10">
          <div>
            <p className="eyebrow">Collection · {n} {n === 1 ? "work" : "works"}</p>
            <h1 className="display relative mt-2 text-[52px] leading-[0.9] [overflow-wrap:anywhere] sm:text-[80px] lg:text-[104px]">
              {collection.title}
            </h1>
            <BrushStroke className="mt-2 h-3 w-48 sm:w-64" />
          </div>
          {collection.description && <p className="whitespace-pre-line text-[17px] leading-relaxed text-ink-2 md:pb-3">{collection.description}</p>}
        </div>
      </header>

      <ul className="mx-auto flex max-w-[1240px] flex-wrap items-start justify-center gap-x-[6%] gap-y-14 px-8 pb-10 pt-6 sm:gap-x-[7%] sm:px-6 lg:gap-x-[4%] lg:gap-y-16">
        {collection.works.map((w, i) => <Hung key={w.id} w={w} i={i} edition={editions.get(w.id) ?? null} />)}
      </ul>

      <nav aria-label="More collections" className="mx-auto mt-4 grid max-w-[1240px] gap-3 px-4 sm:grid-cols-2 sm:px-6">
        <div className="min-w-0">{prev && <Neighbor dir="prev" artistSlug={artist.slug} c={prev} />}</div>
        <div className="min-w-0">{next && <Neighbor dir="next" artistSlug={artist.slug} c={next} />}</div>
      </nav>
      <p className="mt-8 text-center">
        <Link href={`/@${artist.slug}`} className="btn btn-ghost">All of {artist.name.split(" ")[0]}&apos;s work</Link>
      </p>
    </div>
  );
}
