import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserFromCookie } from "@/lib/auth";
import { getArtistPage, venuesFor } from "@/components/artist/data";
import ArtistBanner from "@/components/artist/ArtistBanner";
import ArtistAvatar from "@/components/artist/ArtistAvatar";
import ArtistActions from "@/components/artist/ArtistActions";
import ArtistTabs from "@/components/artist/ArtistTabs";
import WorkGrid from "@/components/artist/WorkGrid";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";

function firstSentence(text: string) {
  const m = text.match(/^[^.!?]+[.!?]?/);
  return (m ? m[0] : text).replace(/[.!?]$/, "").trim();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await getArtistPage(params.slug);
  if (!a) return { title: "Artist not found" };
  const description = a.bio ? firstSentence(a.bio) : `Prints by ${a.name}${a.city ? `, ${a.city}` : ""}.`;
  const image = a.banner?.imageUrl ?? a.avatar ?? undefined;
  return {
    metadataBase: new URL(SITE),
    title: a.name,
    description,
    alternates: { canonical: `/@${a.slug}` },
    openGraph: {
      type: "profile",
      title: `${a.name} on Artfinity`,
      description,
      url: `/@${a.slug}`,
      images: image ? [{ url: image, alt: a.banner?.title ?? a.name }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${a.name} on Artfinity`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

function Stat({ value, label, dab }: { value: string | number; label: string; dab: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <span className="paint-dab h-3 w-5" style={{ ["--dab" as string]: dab }} />
      <b className="display num truncate text-[30px] text-ink">{value}</b>
      <span className="text-[13px] text-ink-2">{label}</span>
    </div>
  );
}

export default async function ArtistPage({ params }: Props) {
  const artist = await getArtistPage(params.slug);
  if (!artist) notFound();

  const me = await getUserFromCookie();
  const isOwner = !!me?.slug && me.slug.toLowerCase() === artist.slug.toLowerCase();
  const venues = venuesFor(artist.slug);
  const tagline = artist.bio ? firstSentence(artist.bio) : "";
  const cityShort = artist.city.split(",")[0];
  const since = artist.memberSince.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const about = (
    <div className="grid max-w-[620px] gap-6">
      {artist.bio ? (
        <p className="font-display text-[26px] font-semibold leading-[1.2] text-ink [font-variation-settings:'wdth'_85] sm:text-[30px]">{artist.bio}</p>
      ) : (
        <p className="text-ink-2">{isOwner ? "Add a line about your work in Edit page." : "No bio yet."}</p>
      )}
      <dl className="grid grid-cols-2 gap-4 border-t border-line pt-5 text-[15px] sm:max-w-[420px]">
        {artist.city && (
          <div>
            <dt className="eyebrow">Based in</dt>
            <dd className="mt-1 font-semibold text-ink">{artist.city}</dd>
          </div>
        )}
        <div>
          <dt className="eyebrow">Member since</dt>
          <dd className="mt-1 font-semibold text-ink">{since}</dd>
        </div>
      </dl>
    </div>
  );

  return (
    <div className="bg-white pb-16 sm:pb-24">
      <ArtistBanner src={artist.banner?.imageUrl ?? null} alt={artist.banner ? `${artist.banner.title}, by ${artist.name}` : ""} />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        {/* Head: avatar overlapping the banner, name, actions */}
        <header className="relative -mt-12 flex flex-wrap items-end gap-x-6 gap-y-4 sm:-mt-16">
          <ArtistAvatar src={artist.avatar} name={artist.name} className="h-24 w-24 sm:h-36 sm:w-36" />
          <div className="grid min-w-0 flex-1 basis-[260px] gap-1.5 pb-1">
            <h1 className="display flex flex-wrap items-center gap-x-3 gap-y-1 text-[44px] sm:text-[64px]">
              <span className="min-w-0 [overflow-wrap:anywhere]">{artist.name}</span>
              {artist.verified && (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-scan-soft px-2.5 py-1 font-body text-[12.5px] font-bold tracking-normal text-scan [font-variation-settings:normal]"
                  title="Has sold prints through Artfinity"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verified
                </span>
              )}
            </h1>
            <p className="truncate text-[15px] text-ink-2 sm:text-base">
              {[artist.city, tagline].filter(Boolean).join(" · ")}
            </p>
          </div>
          <ArtistActions slug={artist.slug} firstName={artist.firstName} className="pb-2" />
        </header>

        <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-12">
          {/* Left column */}
          <aside className="grid content-start gap-7">
            <div className="grid grid-cols-3 gap-4">
              <Stat value={artist.works.length} label={artist.works.length === 1 ? "work" : "works"} dab="#f7c8a8" />
              <Stat value={artist.sales} label={artist.sales === 1 ? "sale" : "sales"} dab="var(--af-sticker)" />
              {cityShort ? <Stat value={cityShort} label="city" dab="#b8c4ff" /> : null}
            </div>

            {artist.bio && <p className="text-[15px] leading-relaxed text-ink-2">{artist.bio}</p>}

            {venues.length > 0 && (
              <section aria-labelledby="in-person" className="grid gap-2.5">
                <h2 id="in-person" className="font-body text-[15px] font-bold [font-variation-settings:normal]">
                  See it in person
                </h2>
                <ul className="grid gap-0 rounded-xl border-[1.5px] border-line bg-wall/50 px-3.5 py-1.5">
                  {venues.map((v) => (
                    <li key={v.name} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-2 text-[14px] last:border-0">
                      <span className="min-w-0 text-ink">{v.name}</span>
                      <span className="shrink-0 text-[12.5px] font-semibold text-ink-2">{v.when}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isOwner && (
              <section aria-label="Your page" className="relative grid gap-3 rounded-2xl border-[1.5px] border-ink bg-white p-4">
                <span className="sticker-badge absolute -top-3 left-4 text-[12px]">Your page</span>
                <p className="pt-1 text-[14px] text-ink-2">Only you see this.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/studio/page" className="btn btn-blue btn-sm">Edit page</Link>
                  <Link href="/studio/qr" className="btn btn-ghost btn-sm">Print codes</Link>
                </div>
              </section>
            )}
          </aside>

          {/* Work / About */}
          <div className="min-w-0">
            <ArtistTabs
              tabs={[
                { id: "work", label: "Work", count: artist.works.length, panel: <WorkGrid works={artist.works} isOwner={isOwner} /> },
                { id: "about", label: "About", panel: about },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
