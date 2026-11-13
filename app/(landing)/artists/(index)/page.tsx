import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import ArtistCard, { YourSpotCard } from "@/components/browse/ArtistCard";
import PageHead, { EmptyCanvas } from "@/components/browse/PageHead";
import { artistSort, getArtists, getCities } from "@/components/browse/data";
import ArtSearch from "@/components/browse/ArtSearch";
import { getTrustBySlug } from "@/lib/artistTrust";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Artists", description: "Independent artists selling prints on Artfinity." };

export default async function ArtistsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const q = (searchParams.q || "").trim().slice(0, 60) || undefined;
  const city = searchParams.city || undefined;
  const sort = artistSort(searchParams.sort);
  const verified = searchParams.verified === "1";
  const started = performance.now();
  const [artists, cities] = await Promise.all([getArtists({ q, city, sort, verified }), getCities()]);
  const trust = await getTrustBySlug(artists.map((a) => a.slug));
  const seconds = (performance.now() - started) / 1000;
  const link = (o: { q?: string; city?: string; verified?: boolean } = {}) => {
    const v = { q, city, verified, ...o };
    const s = new URLSearchParams();
    if (v.q) s.set("q", v.q);
    if (v.city) s.set("city", v.city);
    if (sort !== "popular") s.set("sort", sort);
    if (v.verified) s.set("verified", "1");
    return s.toString() ? `/artists?${s}` : "/artists";
  };
  // What's narrowing the list right now, each removable. Nothing shows when nothing is picked.
  const chips = [
    q && { label: `“${q}”`, href: link({ q: "" }) },
    city && { label: cities.find((c) => c.slug === city)?.name ?? city, href: link({ city: "" }) },
    verified && { label: "Verified artists", href: link({ verified: false }) },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="pb-20">
      <PageHead title="Artists" stroke="var(--af-coral)">
        <ArtSearch kind="artists" q={q} cities={cities.map((c) => ({ slug: c.slug, name: c.name, pieces: c.artists }))} />
      </PageHead>

      {chips.length > 0 && (
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-2 px-4 sm:px-6">
          {chips.map((c) => (
            <Link key={c.label} href={c.href} scroll={false} className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-ink px-3.5 text-[14px] font-semibold text-white no-underline hover:bg-ink/85 md:min-h-[34px]" aria-label={`Remove ${c.label}`}>
              {c.label}<X className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ))}
          {chips.length > 1 && <Link href={sort !== "popular" ? `/artists?sort=${sort}` : "/artists"} scroll={false} className="px-1 text-[14px] font-bold text-ink underline-offset-2 hover:underline">Clear all</Link>}
        </div>
      )}

      <section className="mx-auto mt-6 max-w-[1240px] px-4 sm:px-6 md:mt-8" aria-label="Artists">
        {artists.length ? (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-8">
            {artists.map((a) => <ArtistCard key={a.slug} artist={a} trust={trust.get(a.slug)} />)}
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
        {artists.length > 0 && (
          <p className="t-small mt-12 text-center">
            <span className="num">{artists.length.toLocaleString()}</span> {artists.length === 1 ? "artist" : "artists"} found in <span className="num">{seconds < 0.1 ? Math.max(seconds, 0.001).toFixed(3) : seconds.toFixed(2)}</span> seconds
          </p>
        )}
      </section>
    </div>
  );
}
