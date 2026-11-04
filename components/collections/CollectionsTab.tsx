import Link from "next/link";
import SensitiveImage from "@/components/site/SensitiveImage";
import { getPublicCollections, type PublicCollectionCard } from "@/components/collections/data";

/**
 * "Collections" tab for the artist page: a grid of collection covers, each linking to
 * /@handle/collections/<slug>. Server component. Pass `collections` if you already loaded them
 * (e.g. to show a count on the tab); otherwise it loads them from artistSlug.
 */
export default async function CollectionsTab({ artistSlug, collections }: { artistSlug: string; collections?: PublicCollectionCard[] }) {
  const list = collections ?? (await getPublicCollections(artistSlug));
  if (!list.length) return <p className="text-ink-2">No collections yet.</p>;
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-9 min-[480px]:grid-cols-2 xl:grid-cols-3">
      {list.map((c) => (
        <li key={c.id}>
          <Link href={`/@${artistSlug}/collections/${c.slug}`} className="group grid gap-3 text-ink no-underline">
            {/* a little stack: the cover hung in front of two more pieces */}
            <div className="relative aspect-[5/4] overflow-hidden rounded-[6px] bg-gallery bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#e9e6df_75%)]">
              {c.peek.map((p, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={p.id}
                  src={p.imageUrl}
                  alt=""
                  aria-hidden
                  className={`absolute top-[16%] h-[58%] w-auto bg-white object-contain p-1 opacity-90 shadow-[0_8px_18px_-8px_rgba(21,22,27,.45)] transition duration-300 ${p.sensitive.length ? "blur-md" : ""} ${i === 0 ? "left-[8%] rotate-[-5deg] group-hover:-translate-x-1" : "right-[8%] rotate-[4deg] group-hover:translate-x-1"}`}
                />
              ))}
              {c.cover && (
                <div className="absolute inset-x-[20%] inset-y-[10%] transition duration-300 group-hover:-translate-y-1">
                  <Cover src={c.cover.imageUrl} alt={c.cover.title} sensitive={c.cover.sensitive} />
                </div>
              )}
            </div>
            <div className="flex items-baseline justify-between gap-3 px-0.5">
              <b className="truncate font-display text-[24px] leading-none [font-variation-settings:'wdth'_80] group-hover:underline">{c.title}</b>
              <span className="num shrink-0 text-[13px] text-ink-2">{c.count} {c.count === 1 ? "work" : "works"}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Cover({ src, alt, sensitive }: { src: string; alt: string; sensitive: string[] }) {
  const pic = (
    <div className="grid h-full w-full place-items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="max-h-full max-w-full border-[6px] border-white bg-white object-contain shadow-[0_16px_30px_-10px_rgba(21,22,27,.55)]" />
    </div>
  );
  return sensitive.length ? <SensitiveImage labels={sensitive}>{pic}</SensitiveImage> : pic;
}
