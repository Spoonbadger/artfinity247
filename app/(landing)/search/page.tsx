import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { ArtGrid } from "@/components/browse/ArtCard";
import { Avatar } from "@/components/browse/ArtistCard";
import PageHead, { EmptyCanvas, Pager } from "@/components/browse/PageHead";
import { getArt, getArtists, getCities } from "@/components/browse/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);
  const [{ art, total, pages }, artists, cities] = q
    ? await Promise.all([getArt({ q, page }), page === 1 ? getArtists({ q, pieces: 0, take: 12 }) : Promise.resolve([]), getCities()])
    : [{ art: [], total: 0, pages: 1 }, [], await getCities()];
  const matchCities = q ? cities.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : [];

  return (
    <div className="pb-20">
      <PageHead
        eyebrow="Search"
        title={q ? <>“{q.length > 22 ? q.slice(0, 22) + "…" : q}”</> : "Find art"}
        sub={q ? <><span className="num">{total}</span> {total === 1 ? "piece" : "pieces"}{artists.length > 0 && <>, <span className="num">{artists.length}</span> {artists.length === 1 ? "artist" : "artists"}</>}.</> : "Search titles, artists and cities."}
      />
      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        <form action="/search" method="get" role="search" className="max-w-xl">
          <label className="flex items-center gap-2 rounded-full border-2 border-ink bg-white p-[5px] pl-4 focus-within:border-scan focus-within:shadow-[0_0_0_4px_#d9dcff]">
            <Search className="h-5 w-5 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="sr-only">Search</span>
            <input name="q" type="search" defaultValue={q} autoFocus={!q} placeholder="Mountains, Austin, Maya…" className="w-full min-w-0 border-0 bg-transparent py-2 text-[17px] outline-none placeholder:text-ink-2" />
            <button type="submit" className="btn btn-blue shrink-0">Search</button>
          </label>
        </form>

        {!q && cities.length > 0 && (
          <div className="mt-8">
            <span className="eyebrow">Or browse a city</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {cities.map((c) => <Link key={c.slug} href={`/scenes/${c.slug}`} className="rounded-full border-[1.5px] border-line bg-white px-3.5 py-1.5 text-[14px] font-semibold text-ink no-underline hover:border-ink">{c.name}</Link>)}
            </div>
          </div>
        )}

        {(artists.length > 0 || matchCities.length > 0) && (
          <section className="mt-10" aria-label="Artists and cities">
            <h2 className="display mb-4 text-[30px]">Artists</h2>
            <ul className="flex flex-wrap gap-2.5">
              {artists.map((a) => (
                <li key={a.slug}>
                  <Link href={`/@${a.slug}`} className="flex items-center gap-2.5 rounded-full border-[1.5px] border-line bg-white py-1 pl-1 pr-4 text-ink no-underline hover:border-ink">
                    <Avatar src={a.avatar} name={a.name} className="h-9 w-9 ring-0" />
                    <span className="grid leading-tight"><b className="text-[15px]">{a.name}</b><span className="text-[12.5px] text-ink-2">{a.city}</span></span>
                  </Link>
                </li>
              ))}
              {matchCities.map((c) => (
                <li key={c.slug}>
                  <Link href={`/scenes/${c.slug}`} className="flex h-full items-center gap-2 rounded-full border-[1.5px] border-ink bg-sticker px-4 py-2 text-[15px] font-bold text-ink no-underline">
                    Art from {c.name} <span className="num text-[12.5px] font-semibold">{c.pieces}</span>
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
                <h2 className="display mb-6 text-[30px]">Art</h2>
                <ArtGrid art={art} />
                <Pager page={page} pages={pages} href={(p) => `/search?q=${encodeURIComponent(q)}${p > 1 ? `&page=${p}` : ""}`} />
              </>
            ) : (
              <EmptyCanvas title="Nothing on this wall">
                <p className="text-ink-2">Try fewer words, or browse everything.</p>
                <Link href="/art" className="btn btn-ghost">Browse all art</Link>
              </EmptyCanvas>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
