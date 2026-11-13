import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import ArtSearch from "@/components/browse/ArtSearch";
import { ArtGrid } from "@/components/browse/ArtCard";
import PageHead, { EmptyCanvas, Pager } from "@/components/browse/PageHead";
import { artSort, getArt, getArtists, getCities, priceBand, PRINT_SIZE_KEYS } from "@/components/browse/data";
import { SIZE_LABEL } from "@/components/art/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Browse art", description: "Prints of original art from independent artists, made to order." };

export default async function ArtPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim().slice(0, 80) || undefined;
  const city = searchParams.city || undefined;
  const sort = artSort(searchParams.sort);
  // Starting price range in whole dollars (?min=40&max=80). Older links say ?price=under-50; those become a range.
  const band = priceBand(searchParams.price);
  const dollarsOf = (v: string | undefined) => {
    const n = Number(v);
    return v && Number.isFinite(n) && n >= 0 && n < 100_000 ? Math.round(n) : undefined;
  };
  let min = dollarsOf(searchParams.min) ?? (band && "min" in band ? band.min / 100 : undefined);
  let max = dollarsOf(searchParams.max) ?? (band && "max" in band ? band.max / 100 - 1 : undefined);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  const price = searchParams.min || searchParams.max ? undefined : band?.value;
  const verified = searchParams.verified === "1";
  const size = (PRINT_SIZE_KEYS as string[]).includes(searchParams.size || "") ? searchParams.size : undefined;
  const artist = searchParams.artist?.slice(0, 60) || undefined;
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);

  const started = performance.now();
  const [{ art, total, pages }, cities, artists] = await Promise.all([
    getArt({ q, city, sort, page, size, artistSlug: artist, verified, minCents: min != null ? min * 100 : undefined, maxCents: max != null ? max * 100 + 99 : undefined }),
    getCities(),
    getArtists({ pieces: 0, sort: "az" }),
  ]);
  const seconds = (performance.now() - started) / 1000;
  const filtered = !!(q || city || min != null || max != null || size || artist || verified);

  const current: Record<"q" | "city" | "price" | "min" | "max" | "size" | "artist" | "verified", string | undefined> = {
    q, city, price, min: !price && min != null ? String(min) : undefined, max: !price && max != null ? String(max) : undefined, size, artist, verified: verified ? "1" : undefined,
  };
  const build = (o: Partial<typeof current> & { page?: number } = {}) => {
    const s = new URLSearchParams();
    const v = { ...current, ...o };
    if (v.q) s.set("q", v.q);
    if (v.city) s.set("city", v.city);
    if (sort !== "newest") s.set("sort", sort);
    if (v.price) s.set("price", v.price);
    if (v.min) s.set("min", v.min);
    if (v.max) s.set("max", v.max);
    if (v.verified) s.set("verified", v.verified);
    if (v.size) s.set("size", v.size);
    if (v.artist) s.set("artist", v.artist);
    if (o.page && o.page > 1) s.set("page", String(o.page));
    const str = s.toString();
    return str ? `/art?${str}` : "/art";
  };
  const href = (p: number) => build({ page: p });
  // What's narrowing the results right now, each removable. Nothing shows when nothing is picked.
  const chips = [
    q && { label: `“${q}”`, href: build({ q: "" }) },
    city && { label: cities.find((c) => c.slug === city)?.name ?? city, href: build({ city: "" }) },
    (min != null || max != null) && { label: min != null && max != null ? `$${min} to $${max}` : min != null ? `$${min} and up` : `Up to $${max}`, href: build({ price: undefined, min: undefined, max: undefined }) },
    verified && { label: "Verified artists", href: build({ verified: undefined }) },
    size && { label: SIZE_LABEL[size as keyof typeof SIZE_LABEL] ?? size, href: build({ size: "" }) },
    artist && { label: artists.find((a) => a.slug === artist)?.name ?? artist, href: build({ artist: "" }) },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="pb-20">
      <PageHead title="Browse art">
        <ArtSearch q={q} cities={cities.map((c) => ({ slug: c.slug, name: c.name, pieces: c.pieces }))} priceMin={min != null ? String(min) : undefined} priceMax={max != null ? String(max) : undefined} />
      </PageHead>

      {chips.length > 0 && (
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-2 px-4 sm:px-6">
          {chips.map((c) => (
            <Link key={c.label} href={c.href} scroll={false} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-ink px-3.5 text-[14px] font-semibold text-white no-underline hover:bg-ink/85 md:min-h-[34px]" aria-label={`Remove ${c.label}`}>
              {c.label}<X className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ))}
          {chips.length > 1 && <Link href={sort !== "newest" ? `/art?sort=${sort}` : "/art"} scroll={false} className="px-1 text-[14px] font-bold text-ink underline-offset-2 hover:underline">Clear all</Link>}
        </div>
      )}

      <section className="mx-auto mt-6 max-w-[1240px] px-4 sm:px-6 md:mt-8" aria-label="Artworks">
        {art.length ? (
          <ArtGrid art={art} />
        ) : (
          <EmptyCanvas title="Nothing here yet">
            <p className="t-muted">Try fewer filters or a shorter search.</p>
            {filtered && <Link href="/art" className="btn btn-ghost">Clear filters</Link>}
          </EmptyCanvas>
        )}
        <Pager page={page} pages={pages} href={href} />
        {total > 0 && (
          <p className="t-small mt-12 text-center">
            <span className="num">{total.toLocaleString()}</span> {total === 1 ? "piece" : "pieces"} found in <span className="num">{seconds < 0.1 ? Math.max(seconds, 0.001).toFixed(3) : seconds.toFixed(2)}</span> seconds
          </p>
        )}
      </section>
    </div>
  );
}
