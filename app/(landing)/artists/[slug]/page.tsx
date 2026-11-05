import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import { getUserFromCookie } from "@/lib/auth";
import { bannerColor, getArtistPage, resolveBanner, venuesFor } from "@/components/artist/data";
import { paint, parseTheme } from "@/components/artist/theme";
import TrustBlock from "@/components/artist/TrustBlock";
import Medal from "@/components/af/Medal";
import VerifiedBadge from "@/components/af/VerifiedBadge";
import ArtistBanner from "@/components/artist/ArtistBanner";
import CodeNote from "@/components/qr/CodeNote";
import ArtistAvatar from "@/components/artist/ArtistAvatar";
import ArtistActions from "@/components/artist/ArtistActions";
import ArtistSocials from "@/components/links/ArtistSocials";
import { getArtistSocials } from "@/components/links/data";
import ArtistTabs from "@/components/artist/ArtistTabs";
import CollectionsTab from "@/components/collections/CollectionsTab";
import { getPublicCollections } from "@/components/collections/data";
import { WorkLayout } from "@/components/artist/WorkGrid";
import { getReviews } from "@/lib/reviews";
import ReviewStars from "@/components/reviews/ReviewStars";
import ReviewList from "@/components/reviews/ReviewList";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string }; searchParams?: Record<string, string | string[] | undefined> };

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

/** Studio's live preview passes an unsaved theme as ?theme=<json>. Only the artist themself sees it applied. */
function previewTheme(raw: string | string[] | undefined) {
  if (typeof raw !== "string" || raw.length > 2000) return null;
  try { return JSON.parse(raw) as unknown; } catch { return null; }
}

export default async function ArtistPage({ params, searchParams }: Props) {
  const artist = await getArtistPage(params.slug);
  if (!artist) notFound();
  const socials = await getArtistSocials(artist.id);
  const collections = await getPublicCollections(artist.slug);
  const { summary: rating, reviews } = await getReviews({ artistId: artist.id });

  const me = await getUserFromCookie();
  const isOwner = !!me?.slug && me.slug.toLowerCase() === artist.slug.toLowerCase();
  const preview = isOwner ? previewTheme(searchParams?.theme) : null;
  const theme = preview ? parseTheme(preview, artist.works.map((w) => w.id)) : artist.theme;
  const banner = preview ? resolveBanner(artist.works, theme) : artist.banner;
  const accent = paint(theme.accent);
  const trust = { ...artist.trust, medal: theme.showStats ? artist.trust.earned : null };
  const venues = await venuesFor(artist.id);
  const tagline = artist.bio ? firstSentence(artist.bio) : "";
  const [cityShort, stateShort] = artist.city.split(",").map((s) => s.trim());
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
    <>
      <SiteHeader inPage />
    <div className="bg-white pb-16 sm:pb-24" style={{ ["--accent" as string]: accent.color, ["--accent-ink" as string]: accent.ink, ["--accent-soft" as string]: accent.soft }}>
      {searchParams?.expired === "1" && <CodeNote kind="expired" name={artist.name} />}
      <ArtistBanner src={banner?.imageUrl ?? null} alt={banner ? `${banner.title}, by ${artist.name}` : ""} color={bannerColor(theme)} />

      <div className="mx-auto max-w-[1240px] px-4 sm:px-6">
        {/* Head: avatar overlapping the banner, name, actions */}
        <header className="relative -mt-12 flex flex-wrap items-end gap-x-6 gap-y-4 sm:-mt-16">
          {/* Avatar with the sales medal pinned to its bottom-right */}
          <div className="relative shrink-0">
            <ArtistAvatar src={artist.avatar} name={artist.name} className="h-24 w-24 sm:h-36 sm:w-36" />
            {trust.medal && (
              <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-white p-1 shadow-[0_4px_12px_-4px_rgba(21,22,27,.35)] sm:bottom-0 sm:right-0">
                <Medal tier={trust.medal} size={30} />
              </span>
            )}
          </div>
          <div className="grid min-w-0 flex-1 basis-[260px] gap-1.5 self-end sm:min-h-[96px] sm:content-center">
            <h1 className="display text-[44px] sm:text-[64px]">
              <span className="min-w-0 [overflow-wrap:anywhere]">{artist.name}</span>
              {trust.verified && <VerifiedBadge size={30} verifiedAt={trust.verifiedAt} className="relative -top-1 ml-2.5 align-middle" />}
            </h1>
            <ReviewStars average={rating.average} count={rating.count} href="#reviews" className="w-fit" />
          </div>
          <div className="flex flex-wrap items-center gap-3 pb-2 sm:ml-auto">
            <ArtistSocials links={socials} />
            <Link href={`/@${artist.slug}/links`} className="btn btn-ghost btn-sm h-11 px-5">Links</Link>
            <ArtistActions slug={artist.slug} firstName={artist.firstName} />
          </div>
        </header>

        <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-12">
          {/* Left column */}
          <aside className="grid content-start gap-7">
            <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-7 gap-y-4">
              <Stat value={artist.works.length} label={artist.works.length === 1 ? "work" : "works"} dab="#f7c8a8" />
              {theme.showStats && artist.sales > 0 ? <Stat value={artist.sales} label={artist.sales === 1 ? "print sold" : "prints sold"} dab="var(--accent)" /> : null}
              {cityShort ? <Stat value={cityShort} label={stateShort || "city"} dab="#b8c4ff" /> : null}
            </div>

            <TrustBlock trust={trust} />

            {artist.bio && <p className="text-[15px] leading-relaxed text-ink-2">{artist.bio}</p>}

            {venues.length > 0 && (
              <section aria-labelledby="in-person" className="grid gap-2.5">
                <h2 id="in-person" className="font-body text-[15px] font-bold [font-variation-settings:normal]">
                  See it in person
                </h2>
                <ul className="grid gap-0 rounded-xl border-[1.5px] border-line bg-wall/50 px-3.5 py-1.5">
                  {venues.map((v, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-2 text-[14px] last:border-0">
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
                  <Link href="/studio/design" className="btn btn-ghost btn-sm">Design</Link>
                  {!artist.trust.verified && <Link href="/studio/verify" className="btn btn-ghost btn-sm">Get verified</Link>}
                </div>
              </section>
            )}
          </aside>

          {/* Work / About */}
          <div className="min-w-0">
            <ArtistTabs
              tabs={[
                { id: "work", label: "Work", count: artist.works.length, panel: <WorkLayout works={artist.works} layout={theme.layout} pinned={theme.pinned} isOwner={isOwner} /> },
                ...(collections.length ? [{ id: "collections", label: "Collections", count: collections.length, panel: <CollectionsTab artistSlug={artist.slug} collections={collections} /> }] : []),
                ...(rating.count ? [{
                  id: "reviews", label: "Reviews", count: rating.count,
                  panel: (
                    <div className="grid gap-5">
                      <ReviewStars average={rating.average} count={rating.count} size="lg" />
                      <ReviewList reviews={reviews} artistName={artist.firstName || artist.name} showArtwork />
                    </div>
                  ),
                }] : []),
                { id: "about", label: "About", panel: about },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
