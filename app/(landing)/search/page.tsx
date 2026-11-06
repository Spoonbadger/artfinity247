import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ArtGrid } from "@/components/browse/ArtCard";
import { Avatar } from "@/components/browse/ArtistCard";
import PageHead, { EmptyCanvas, Pager } from "@/components/browse/PageHead";
import { ART_SORTS, artSort, getArt, getArtists, getCities } from "@/components/browse/data";
import { UrlSort } from "@/components/browse/UrlSort";
import SearchTypeahead from "@/components/forms/SearchTypeahead";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const sort = artSort(searchParams.sort);
  const [{ art, total, pages }, artists, cities] = q
    ? await Promise.all([getArt({ q, page, sort }), page === 1 ? getArtists({ q, pieces: 0, take: 12 }) : Promise.resolve([]), getCities()])
    : [{ art: [], total: 0, pages: 1 }, [], await getCities()];
  const matchCities = q ? cities.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : [];

  return (
    <div className="pb-20">
      <PageHead
        eyebrow="Search"
        title={q ? <>“{q.length > 22 ? q.slice(0, 22) + "…" : q}”</> : "Find art"}
        sub={q ? <><span className="num">{total}</span> {total === 1 ? "piece" : "pieces"}{artists.length > 0 && <>, <span className="num">{artists.length}</span> {artists.length === 1 ? "artist" : "artists"}</>}.</> : "Search titles, artists and neighborhoods."}
      />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <form action="/search" method="get" role="search" className="max-w-xl">
          <div className="relative flex items-center gap-2 rounded-full border-2 border-ink bg-white p-[5px] pl-4 focus-within:border-scan focus-within:shadow-[0_0_0_4px_#d9dcff]">
            <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
            <SearchTypeahead key={q} defaultValue={q} autoFocus={!q} label="Search" placeholder="Sunsets, Brooklyn, Maya…" inputClassName="w-full min-w-0 border-0 bg-transparent py-2 text-[17px] outline-none placeholder:text-ink-2" />
            <button type="submit" className="btn btn-blue shrink-0">Search</button>
          </div>
        </form>

        {!q && cities.length > 0 && (
          <div className="mt-8">
            <span className="eyebrow">Or browse a neighborhood</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {cities.map((c) => <Link key={c.slug} href={`/scenes/${c.slug}`} className="inline-flex min-h-[44px] items-center rounded-full border-[1.5px] border-line bg-white px-4 py-1.5 text-[14px] font-semibold text-ink no-underline hover:border-ink">{c.name}</Link>)}
            </div>
          </div>
        )}

        {(artists.length > 0 || matchCities.length > 0) && (
          <section className="mt-10" aria-label="Artists and neighborhoods">
            <h2 className="t-section mb-4">Artists</h2>
            <ul className="flex flex-wrap gap-2.5">
              {artists.map((a) => (
                <li key={a.slug}>
                  <Link href={`/@${a.slug}`} className="flex items-center gap-2.5 rounded-full border-[1.5px] border-line bg-white py-1 pl-1 pr-4 text-ink no-underline hover:border-ink">
                    <Avatar src={a.avatar} name={a.name} className="h-9 w-9 ring-0" />
                    <span className="grid leading-tight"><b className="text-[15px]">{a.name}</b><span className="t-small">{a.city}</span></span>
                  </Link>
                </li>
              ))}
              {matchCities.map((c) => (
                <li key={c.slug}>
                  <Link href={`/scenes/${c.slug}`} className="flex h-full items-center gap-2 rounded-full border-[1.5px] border-ink bg-sticker px-4 py-2 text-[15px] font-bold text-ink no-underline">
                    Art from {c.name} <span className="num text-[13px] font-semibold">{c.pieces}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {q && (
          <section className="mt-12" aria-label="Artworks">
            {art.length ? (
              <>
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="t-section">Art</h2>
                  {total > 1 && <UrlSort storageKey="search.art" options={ART_SORTS} fallback="newest" />}
                </div>
                <ArtGrid art={art} />
                <Pager page={page} pages={pages} href={(p) => `/search?q=${encodeURIComponent(q)}${sort !== "newest" ? `&sort=${sort}` : ""}${p > 1 ? `&page=${p}` : ""}`} />
              </>
            ) : (
              <EmptyCanvas title="Nothing on this wall">
                <p className="t-muted">Try fewer words, or browse everything.</p>
                <Link href="/art" className="btn btn-ghost">Browse all art</Link>
              </EmptyCanvas>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
