import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import ArtistCard, { YourSpotCard } from "@/components/browse/ArtistCard";
import PageHead, { EmptyCanvas } from "@/components/browse/PageHead";
import { getArtists, getCities } from "@/components/browse/data";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artists", description: "Independent artists selling prints on Artfinity." };

export default async function ArtistsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim().slice(0, 60) || undefined;
  const city = searchParams.city || undefined;
  const [artists, cities] = await Promise.all([getArtists({ q, city }), getCities()]);
  const link = (c?: string) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (c) s.set("city", c);
    return s.toString() ? `/artists?${s}` : "/artists";
  };

  return (
    <div className="pb-20">
      <PageHead
        eyebrow="Hanging codes now"
        title="Artists"
        sub={<><span className="num">{artists.length}</span> {artists.length === 1 ? "artist" : "artists"}{city ? "" : <> in <span className="num">{cities.length}</span> {cities.length === 1 ? "city" : "cities"}</>}.</>}
        stroke="var(--af-coral)"
      >
        <form action="/artists" method="get" role="search" className="w-full md:w-auto">
          {city && <input type="hidden" name="city" value={city} />}
          <label className="flex items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 focus-within:border-scan md:w-72">
            <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
            <span className="sr-only">Search artists</span>
            <input name="q" type="search" defaultValue={q} placeholder="Find an artist" className="w-full min-w-0 border-0 bg-transparent p-0 py-1 text-[16px] md:py-0 md:text-[15px] outline-none placeholder:text-ink-2" />
          </label>
        </form>
      </PageHead>

      {cities.length > 1 && (
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {[{ slug: "", name: "Everywhere" }, ...cities].map((c) => {
              const active = (city || "") === c.slug;
              return (
                <Link key={c.slug || "all"} href={link(c.slug || undefined)} aria-current={active ? "true" : undefined}
                  className={cn("inline-flex min-h-[44px] shrink-0 items-center rounded-full border-[1.5px] px-4 py-1.5 text-[14px] md:min-h-0 md:px-3.5 font-semibold no-underline transition", active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
                  {c.name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <section className="mx-auto mt-6 max-w-[1240px] px-4 sm:px-6 md:mt-8" aria-label="Artists">
        {artists.length ? (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
            {artists.map((a) => <ArtistCard key={a.slug} artist={a} />)}
            {!q && <YourSpotCard />}
          </div>
        ) : (
          <EmptyCanvas title="No one by that name yet">
            <p className="text-ink-2">Maybe it’s you.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/artists" className="btn btn-ghost">All artists</Link>
              <Link href="/register" className="btn btn-blue">Start selling free</Link>
            </div>
          </EmptyCanvas>
        )}
      </section>
    </div>
  );
}
