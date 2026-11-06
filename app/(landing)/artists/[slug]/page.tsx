import type { Metadata } from "next";
import { previewImage, sharePreview } from "@/lib/og";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { movedHandle } from "@/lib/handleRedirects";
import { artistPath } from "@/lib/urls";
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
import ArtistReviews from "@/components/artist/ArtistReviews";
import { activeFollowerCount } from "@/lib/followers";
import ViewBeacon from "@/components/analytics/ViewBeacon";
import { UrlSort } from "@/components/browse/UrlSort";
import type { ArtistWork } from "@/components/artist/data";
import { FREE_SPLIT, pct } from "@/lib/plans";

const WORK_SORTS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
];
function sortWorks(works: ArtistWork[], sort: string | string[] | undefined) {
  const by: Record<string, (a: ArtistWork, b: ArtistWork) => number> = {
    popular: (a, b) => b.sold - a.sold,
    "price-asc": (a, b) => a.fromCents - b.fromCents,
    "price-desc": (a, b) => b.fromCents - a.fromCents,
  };
  const fn = typeof sort === "string" ? by[sort] : undefined;
  return fn ? [...works].sort(fn) : works; // stable, so ties stay newest first
}

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
  // The banner piece (never a sensitive one), else their photo, else the Artfinity card.
  const image = previewImage(
    a.banner && { url: a.banner.imageUrl, alt: `${a.banner.title}, by ${a.name}`, sensitive: a.banner.sensitive },
    { url: a.avatar, alt: a.name },
  );
  return {
    metadataBase: new URL(SITE),
    title: a.name,
    description,
    alternates: { canonical: `/@${a.slug}` },
    ...sharePreview({ type: "profile", title: `${a.name} on Artfinity`, description, url: `/@${a.slug}`, image }),
  };
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <b className="t-card num truncate">{value}</b>
      <span className="t-small">{label}</span>
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
  if (!artist) {
    // Renamed by an admin: the old handle keeps working.
    const moved = await movedHandle(params.slug);
    if (moved) permanentRedirect(artistPath(moved));
    notFound();
  }
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
  const followers = await activeFollowerCount(artist.id);
  const tagline = artist.bio ? firstSentence(artist.bio) : "";
  const [cityShort, stateShort] = artist.city.split(",").map((s) => s.trim());
  const since = artist.memberSince.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const about = (
    <div className="grid max-w-[620px] gap-6">
      {artist.bio ? (
        <p className="t-body text-[17px] leading-[1.7]">{artist.bio}</p>
      ) : (
        <p className="t-muted">{isOwner ? "Add a line about your work in Edit page." : "No bio yet."}</p>
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
      <ViewBeacon artistId={artist.id} />
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
          {/* Follow first on phones; socials and Links sit after it */}
          <div className="flex flex-wrap items-center gap-3 pb-2 sm:ml-auto">
            <ArtistActions slug={artist.slug} firstName={artist.firstName} className="max-sm:order-first" />
            <ArtistSocials links={socials} />
            <Link href={`/@${artist.slug}/links`} className="btn btn-ghost btn-sm h-11 px-5">Links</Link>
          </div>
        </header>

        <div className="mt-8 grid gap-10 sm:mt-10 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-12">
          {/* Left column. On phones it drops below the work, so the art is on the first screen. */}
          <aside className="grid content-start gap-7 max-lg:order-last">
            <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-x-7 gap-y-4">
              <Stat value={artist.works.length} label={artist.works.length === 1 ? "work" : "works"} />
              {theme.showStats && artist.sales > 0 ? <Stat value={artist.sales} label={artist.sales === 1 ? "print sold" : "prints sold"} /> : null}
              {cityShort ? <Stat value={cityShort} label={stateShort || "city"} /> : null}
            </div>
            {/* Follower count, quietly, once it's worth showing */}
            {theme.showStats && followers >= 10 && (
              <p className="t-small -mt-3"><b className="num font-semibold text-ink">{followers.toLocaleString("en-US")}</b> followers</p>
            )}

            <TrustBlock trust={trust} />

            {artist.bio && <p className="t-muted">{artist.bio}</p>}

            <p className="t-small">Every print is made in NYC and ships free in the US. {artist.firstName || artist.name} gets at least {pct(FREE_SPLIT)} of the profit.</p>

            {venues.length > 0 && (
              <section aria-labelledby="in-person" className="grid gap-2.5">
                <h2 id="in-person" className="t-card">
                  See it in person
                </h2>
                <ul className="box-inset grid gap-0 px-3.5 py-1.5">
                  {venues.map((v, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 border-b border-dashed border-line py-2 text-[14px] last:border-0">
                      <span className="min-w-0 text-ink">{v.name}</span>
                      <span className="t-small shrink-0 font-semibold">{v.when}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {isOwner && (
              <section aria-label="Your page" className="relative grid gap-3 rounded-2xl border border-edge bg-white p-4">
                <span className="sticker-badge absolute -top-3 left-4 text-[12px]">Your page</span>
                <p className="t-small pt-1">Only you see this.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/studio/page" className="btn btn-sm">Edit page</Link>
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
                {
                  id: "work", label: "Work", count: artist.works.length,
                  panel: (
                    <>
                      {artist.works.length > 3 && (
                        <div className="mb-4 flex justify-end">
                          <UrlSort storageKey="artist.work" options={WORK_SORTS} fallback="newest" />
                        </div>
                      )}
                      <WorkLayout works={sortWorks(artist.works, searchParams?.sort)} layout={theme.layout} pinned={theme.pinned} isOwner={isOwner} />
                    </>
                  ),
                },
                ...(collections.length ? [{ id: "collections", label: "Collections", count: collections.length, panel: <CollectionsTab artistSlug={artist.slug} collections={collections} /> }] : []),
                ...(rating.count ? [{
                  id: "reviews", label: "Reviews", count: rating.count,
                  panel: <ArtistReviews reviews={reviews} average={rating.average} count={rating.count} artistName={artist.firstName || artist.name} />,
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
