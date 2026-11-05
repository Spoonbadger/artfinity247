import type { Metadata } from "next";
import { previewImage, sharePreview } from "@/lib/og";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ArtFilters from "@/components/browse/ArtFilters";
import { ArtGrid } from "@/components/browse/ArtCard";
import { Avatar } from "@/components/browse/ArtistCard";
import PageHead, { EmptyCanvas, Pager } from "@/components/browse/PageHead";
import { artSort, getArt, getArtists, getCities } from "@/components/browse/data";

export const dynamic = "force-dynamic";

const humanize = (s: string) => s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const name = humanize(decodeURIComponent(params.slug));
  const title = `Art from ${name}`;
  const description = `Prints by independent artists in ${name}.`;
  const { art } = await getArt({ city: decodeURIComponent(params.slug), perPage: 6 }).catch(() => ({ art: [] as Awaited<ReturnType<typeof getArt>>["art"] }));
  const image = previewImage(...art.map((a) => ({ url: a.imageUrl, alt: `${a.title}, by ${a.artist.name}`, sensitive: a.sensitive })));
  return { title, description, ...sharePreview({ title, description, url: `/scenes/${params.slug}`, image }) };
}

export default async function ScenePage({ params, searchParams }: { params: { slug: string }; searchParams: Record<string, string | undefined> }) {
  const slug = decodeURIComponent(params.slug).toLowerCase();
  const q = (searchParams.q || "").trim().slice(0, 80) || undefined;
  const sort = artSort(searchParams.sort);
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);

  const [cities, { art, total, pages }, artists] = await Promise.all([
    getCities(),
    getArt({ city: slug, q, sort, page }),
    getArtists({ city: slug, pieces: 0 }),
  ]);
  const city = cities.find((c) => c.slug === slug);
  if (!city && !artists.length) notFound();
  const name = city?.name || humanize(slug);

  const href = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (sort !== "newest") s.set("sort", sort);
    if (p > 1) s.set("page", String(p));
    return s.toString() ? `/scenes/${slug}?${s}` : `/scenes/${slug}`;
  };

  return (
    <div className="pb-20">
      <div className="mx-auto max-w-[1240px] px-4 pt-6 sm:px-6">
        <Link href="/scenes" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-ink-2 no-underline hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden="true" />All neighborhoods</Link>
      </div>
      <PageHead
        className="pt-4 md:pt-6"
        eyebrow={city?.label || "Neighborhood"}
        title={name}
        sub={<><span className="num">{city?.pieces ?? total}</span> pieces by <span className="num">{artists.length}</span> local {artists.length === 1 ? "artist" : "artists"}.</>}
        stroke="var(--af-scan)"
      >
        <ArtFilters action={`/scenes/${slug}`} q={q} placeholder={`Search ${name}`} storageKey="browse.neighborhood" />
      </PageHead>

      {artists.length > 0 && (
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" aria-label={`Artists in ${name}`}>
            {artists.map((a) => (
              <li key={a.slug} className="shrink-0">
                <Link href={`/@${a.slug}`} className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white py-1 pl-1 pr-3.5 text-[14px] font-semibold text-ink no-underline hover:border-ink">
                  <Avatar src={a.avatar} name={a.name} className="h-8 w-8 text-sm ring-0" />
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mx-auto mt-6 max-w-[1240px] px-4 sm:px-6 md:mt-8" aria-label="Artworks">
        {art.length ? (
          <ArtGrid art={art} />
        ) : (
          <EmptyCanvas title={q ? "Nothing matches that" : `No art from ${name} yet`}>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/art" className="btn btn-ghost">Browse all art</Link>
              <Link href="/register" className="btn btn-blue">Hang the first code</Link>
            </div>
          </EmptyCanvas>
        )}
        <Pager page={page} pages={pages} href={href} />
      </section>
    </div>
  );
}
