import Image from "next/image";
import Link from "next/link";
import SensitiveImage from "@/components/site/SensitiveImage";
import { cn } from "@/lib/utils";
import { money, type ArtistWork } from "./data";
import type { Layout } from "./theme";
import WishlistHeart from "@/components/collector/WishlistHeart";

/** The artist's approved work: 2 columns on phones, 3 on desktop. Each piece links to its buy page. */
export default function WorkGrid({ works, isOwner }: { works: ArtistWork[]; isOwner?: boolean }) {
  if (works.length === 0) return <EmptyWall isOwner={isOwner} />;

  const topSold = Math.max(...works.map((w) => w.sold));

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-9">
      {works.map((w, i) => {
        const href = w.href;
        const best = topSold >= 3 && w.sold === topSold;
        return (
          <li key={w.id} className="relative min-w-0">
            <Link href={href} className="group grid gap-2.5 text-ink no-underline">
              <div className="relative aspect-[4/5] overflow-hidden rounded-[4px] bg-gallery shadow-[0_14px_28px_-16px_rgba(21,22,27,.45)]">
                <SensitiveImage labels={w.sensitive}>
                  <Image
                    src={w.imageUrl}
                    alt={w.title}
                    fill
                    sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 48vw"
                    priority={i < 3}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </SensitiveImage>
                {best && w.sensitive.length === 0 && (
                  <span className="sticker-badge pointer-events-none absolute left-2 top-2 text-[11.5px] sm:left-3 sm:top-3">Best seller</span>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span className="truncate text-[15px] font-semibold group-hover:text-[var(--accent,var(--af-scan))]">{w.title}</span>
                <span className="num shrink-0 text-[13.5px] text-ink-2">from {money(w.fromCents)}</span>
              </div>
            </Link>
            <WishlistHeart artworkId={w.id} title={w.title} className="absolute right-2 top-2 sm:right-3 sm:top-3" />
          </li>
        );
      })}
    </ul>
  );
}

function EmptyWall({ isOwner }: { isOwner?: boolean }) {
  return (
    <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-line bg-wall/60 p-8">
      <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "var(--accent, var(--af-sticker))" }} />
      <p className="text-[17px] font-semibold text-ink">{isOwner ? "Your page is live — add your first piece" : "New work coming soon."}</p>
      <p className="max-w-[52ch] text-[14px] text-ink-2">
        {isOwner
          ? "Only you see this note. Each piece you add hangs here, ready to order as a print, with a QR code you can print right after."
          : "This artist is getting their wall ready. Follow to hear when the first piece goes up."}
      </p>
      {isOwner ? (
        <Link href="/studio/art/new" className="btn btn-blue btn-sm">
          Add your first piece
        </Link>
      ) : (
        <Link href="/art" className="text-[14px] font-semibold text-ink underline underline-offset-4">
          Browse art from other artists
        </Link>
      )}
    </div>
  );
}

const hrefFor = (w: ArtistWork) => w.href;

/** One big column: each piece uncropped on a patch of wall, title and price under it. */
export function WorkSingle({ works, isOwner }: { works: ArtistWork[]; isOwner?: boolean }) {
  if (works.length === 0) return <EmptyWall isOwner={isOwner} />;
  return (
    <ul className="mx-auto grid max-w-[760px] gap-10 sm:gap-14">
      {works.map((w, i) => (
        <li key={w.id} className="min-w-0">
          <Link href={hrefFor(w)} className="group grid gap-3 text-ink no-underline">
            <div className="relative grid place-items-center overflow-hidden rounded-md bg-wall px-[7%] py-[8%]">
              <SensitiveImage labels={w.sensitive}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={w.imageUrl}
                  alt={w.title}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="mx-auto max-h-[72vh] w-auto max-w-full bg-white object-contain shadow-[0_1px_0_rgba(21,22,27,.08),0_22px_40px_-14px_rgba(21,22,27,.45)] transition-transform duration-500 group-hover:-translate-y-1"
                />
              </SensitiveImage>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <span className="display truncate text-[26px] group-hover:text-[var(--accent,var(--af-scan))] sm:text-[32px]">{w.title}</span>
              <span className="num shrink-0 text-[14px] text-ink-2">from {money(w.fromCents)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Salon hang: blocks of four that tile a 4-column wall (and a 2-column one on phones) with no gaps:
// A = big, tall, small, small; B = tall, big, small, small. Leftover pieces get spans that still close the wall.
const BIG = "col-span-2 row-span-2";
const TALL = "row-span-2";
const SMALL = "";
function salonSpans(n: number) {
  const out: string[] = [];
  const full = Math.floor(n / 4);
  for (let b = 0; b < full; b++) out.push(...(b % 2 ? [TALL, BIG, SMALL, SMALL] : [BIG, TALL, SMALL, SMALL]));
  const rest = n % 4;
  if (rest === 1) out.push("col-span-2 row-span-2 sm:col-span-4");
  if (rest === 2) out.push("row-span-2 sm:col-span-2", "row-span-2 sm:col-span-2");
  if (rest === 3) out.push(BIG, TALL, TALL);
  return out;
}

/** Salon wall: mixed sizes hung edge to edge on a wall-colored ground. */
export function WorkSalon({ works, isOwner }: { works: ArtistWork[]; isOwner?: boolean }) {
  if (works.length === 0) return <EmptyWall isOwner={isOwner} />;
  const spans = salonSpans(works.length);
  return (
    <div className="rounded-lg bg-[#ebe7de] p-3 shadow-[inset_0_2px_12px_rgba(21,22,27,.06)] sm:p-6">
      <ul className="grid grid-flow-dense auto-rows-[118px] grid-cols-2 gap-3 sm:auto-rows-[150px] sm:grid-cols-4 sm:gap-5">
        {works.map((w, i) => (
          <li key={w.id} className={cn("min-w-0", spans[i])}>
            <Link href={hrefFor(w)} className="group relative block h-full w-full text-ink no-underline" aria-label={`${w.title}, from ${money(w.fromCents)}`}>
              <div className="absolute inset-0 border-[5px] border-[#2a2622] bg-white p-[6%] shadow-[0_14px_24px_-10px_rgba(21,22,27,.55)] transition-transform duration-500 group-hover:-translate-y-1 sm:border-[7px]">
                <div className="relative h-full w-full overflow-hidden bg-gallery">
                  <SensitiveImage labels={w.sensitive}>
                    <Image src={w.imageUrl} alt={w.title} fill sizes="(min-width: 640px) 40vw, 50vw" className="object-cover" priority={i < 2} />
                  </SensitiveImage>
                </div>
              </div>
              <span className="pointer-events-none absolute bottom-2 left-2 max-w-[calc(100%-16px)] truncate rounded-[2px] bg-white px-2 py-0.5 text-[11.5px] font-semibold text-ink shadow-sm transition sm:bottom-3 sm:left-3 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                {w.title}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Up to three pieces the artist pinned, hung bigger above the rest. */
export function PinnedRow({ works }: { works: ArtistWork[] }) {
  if (!works.length) return null;
  const n = works.length;
  return (
    <section aria-labelledby="pinned-h" className="mb-8 grid gap-3 sm:mb-10">
      <h2 id="pinned-h" className="flex items-center gap-2 text-[15px] font-bold">
        <span className="paint-dab" style={{ ["--dab" as string]: "var(--accent, var(--af-sticker))" }} aria-hidden="true" />
        Pinned
      </h2>
      <ul className={cn("grid gap-3 sm:gap-5", n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        {works.map((w, i) => (
          <li key={w.id} className={cn("min-w-0", n === 3 && i === 0 && "col-span-2 sm:col-span-1")}>
            <Link href={hrefFor(w)} className="group grid gap-2 text-ink no-underline">
              <div className={cn("relative overflow-hidden rounded-[4px] bg-gallery shadow-[0_18px_32px_-16px_rgba(21,22,27,.5)]", n === 1 ? "aspect-[16/10]" : n === 3 && i === 0 ? "aspect-[16/10] sm:aspect-[4/5]" : "aspect-[4/5]")}>
                <SensitiveImage labels={w.sensitive}>
                  <Image src={w.imageUrl} alt={w.title} fill sizes="(min-width: 1024px) 420px, 90vw" priority className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </SensitiveImage>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                <span className="truncate text-[15.5px] font-bold group-hover:text-[var(--accent,var(--af-scan))]">{w.title}</span>
                <span className="num shrink-0 text-[13.5px] text-ink-2">from {money(w.fromCents)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The Work tab for a page theme: pinned pieces first, then the rest in the chosen layout. */
export function WorkLayout({ works, layout, pinned, isOwner }: { works: ArtistWork[]; layout: Layout; pinned: string[]; isOwner?: boolean }) {
  const pins = pinned.map((id) => works.find((w) => w.id === id)).filter((w): w is ArtistWork => !!w);
  const pinSet = new Set(pins.map((w) => w.id));
  const rest = works.filter((w) => !pinSet.has(w.id));
  const Body = layout === "single" ? WorkSingle : layout === "salon" ? WorkSalon : WorkGrid;
  return (
    <>
      <PinnedRow works={pins} />
      {(rest.length > 0 || pins.length === 0) && <Body works={rest} isOwner={isOwner} />}
    </>
  );
}
