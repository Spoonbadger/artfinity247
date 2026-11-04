import Image from "next/image";
import Link from "next/link";
import SensitiveImage from "@/components/site/SensitiveImage";
import { money, type ArtistWork } from "./data";

/** The artist's approved work: 2 columns on phones, 3 on desktop. Each piece links to its buy page. */
export default function WorkGrid({ works, isOwner }: { works: ArtistWork[]; isOwner?: boolean }) {
  if (works.length === 0) {
    return (
      <div className="grid justify-items-start gap-3 rounded-2xl border border-dashed border-line bg-wall/60 p-8">
        <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
        <p className="text-[17px] font-semibold text-ink">{isOwner ? "Your wall is empty." : "New work coming soon."}</p>
        {isOwner && (
          <Link href="/studio" className="btn btn-blue btn-sm">
            Add your first piece
          </Link>
        )}
      </div>
    );
  }

  const topSold = Math.max(...works.map((w) => w.sold));

  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-9">
      {works.map((w, i) => {
        const href = w.slug ? `/art/${w.slug}` : "#";
        const best = topSold >= 3 && w.sold === topSold;
        return (
          <li key={w.id} className="min-w-0">
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
                <span className="truncate text-[15px] font-semibold group-hover:text-scan">{w.title}</span>
                <span className="num shrink-0 text-[13.5px] text-ink-2">from {money(w.fromCents)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
