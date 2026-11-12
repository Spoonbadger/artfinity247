import type { Metadata } from "next";
import Link from "next/link";
import ArtFilters from "@/components/browse/ArtFilters";
import { ArtGrid } from "@/components/browse/ArtCard";
import PageHead, { EmptyCanvas, Pager } from "@/components/browse/PageHead";
import { artSort, getArt, getArtists, getCities, priceBand, PRINT_SIZE_KEYS } from "@/components/browse/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Browse art", description: "Prints of original art from independent artists, made to order." };

export default async function ArtPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim().slice(0, 80) || undefined;
  const city = searchParams.city || undefined;
  const sort = artSort(searchParams.sort);
  const price = priceBand(searchParams.price)?.value;
  const size = (PRINT_SIZE_KEYS as string[]).includes(searchParams.size || "") ? searchParams.size : undefined;
  const artist = searchParams.artist?.slice(0, 60) || undefined;
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);

  const [{ art, total, pages }, cities, artists] = await Promise.all([
    getArt({ q, city, sort, page, price, size, artistSlug: artist }),
    getCities(),
    getArtists({ pieces: 0, sort: "az" }),
  ]);
  const cityName = cities.find((c) => c.slug === city)?.label;
  const filtered = !!(q || city || price || size || artist);

  const build = (o: { city?: string; page?: number }) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (o.city) s.set("city", o.city);
    if (sort !== "newest") s.set("sort", sort);
    if (price) s.set("price", price);
    if (size) s.set("size", size);
    if (artist) s.set("artist", artist);
    if (o.page && o.page > 1) s.set("page", String(o.page));
    const str = s.toString();
    return str ? `/art?${str}` : "/art";
  };
  const href = (p: number) => build({ city, page: p });

  return (
    <div className="pb-20">
      <PageHead
        eyebrow={cityName ? `Art from ${cityName}` : "Prints, made to order"}
        title="Browse art"
        sub={<><span className="num">{total}</span> {total === 1 ? "piece" : "pieces"}{q ? <> matching “{q}”</> : null}. Printed to order, free US shipping.</>}
      >
        <ArtFilters q={q} filters artists={artists.map((a) => ({ slug: a.slug, name: a.name }))} />
      </PageHead>

      {cities.length > 1 && (
        <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            <CityChip href={build({})} active={!city} label="Everywhere" />
            {cities.map((c) => <CityChip key={c.slug} href={build({ city: c.slug })} active={city === c.slug} label={c.name} count={c.pieces} />)}
          </div>
        </div>
      )}

      <section className="mx-auto mt-6 max-w-[1240px] px-4 sm:px-6 md:mt-8" aria-label="Artworks">
        {art.length ? (
          <ArtGrid art={art} />
        ) : (
          <EmptyCanvas title="Nothing on this wall yet">
            <p className="t-muted">Try fewer filters or a shorter search.</p>
            {filtered && <Link href="/art" className="btn btn-ghost">Clear filters</Link>}
          </EmptyCanvas>
        )}
        <Pager page={page} pages={pages} href={href} />
      </section>
    </div>
  );
}

function CityChip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-4 py-1.5 text-[14px] md:min-h-0 md:px-3.5 font-semibold no-underline transition ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
    >
      {label}
      {count != null && <span className={`num text-[13px] ${active ? "text-white/70" : "text-ink-2"}`}>{count}</span>}
    </Link>
  );
}
