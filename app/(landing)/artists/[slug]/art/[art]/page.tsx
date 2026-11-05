import { scanDiscount } from "@/lib/scanSign";
import { cookies } from "next/headers";
import { codeForArt, CODE_COOKIE } from "@/lib/shortlinks";
import type { Metadata, Viewport } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { artPath, SITE_URL, withQuery } from "@/lib/urls";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import ScanView from "@/components/art/ScanView";
import ViewBeacon from "@/components/analytics/ViewBeacon";
import SiteHeader from "@/components/site/SiteHeader";
import { getArtistTrust } from "@/lib/artistTrust";
import { PRINT_SIZES, parseDiscount, parseVenue, priceFor } from "@/components/art/pricing";
import { editionOf, soldCount } from "@/lib/editions";
import { getArtistSplitFor } from "@/lib/revenue";
import { deliveryRange } from "@/lib/delivery";
import { getReviews } from "@/lib/reviews";
import { galleryRooms, imageFacts } from "@/lib/artGallery";
import { paint, parseTheme } from "@/components/artist/theme";

export const dynamic = "force-dynamic";

// viewport-fit=cover so the sticky buy bar can sit above the iPhone home indicator
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

// Served at /@handle/art/<slug> (rewrite in next.config.mjs). params.slug is the handle, params.art the artwork slug.
type Props = { params: { slug: string; art: string }; searchParams: Record<string, string | string[] | undefined> };

const artSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  imageUrl: true,
  status: true,
  sensitive: true,
  artistId: true,
  markupSmall: true,
  markupMedium: true,
  markupLarge: true,
  markupXl: true,
  editionSize: true,
  roomScenes: true,
  printableSizes: true,
  artist: { select: { id: true, slug: true, name: true, artist_name: true, profileImage: true, city: true, state: true, proUntil: true, closedAt: true, suspendedAt: true, pageTheme: true } },
} as const;

async function loadArt(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug);
  return prisma.artwork.findUnique({ where: { slug }, select: artSelect });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const art = await loadArt(params.art).catch(() => null);
  if (!art || art.status !== "APPROVED" || art.artist.closedAt || art.artist.suspendedAt) return { title: "Artwork" };
  const name = art.artist.artist_name || art.artist.name;
  const url = artPath(art.artist.slug, art.slug!);
  return {
    metadataBase: new URL(SITE_URL),
    title: `${art.title} by ${name}`,
    description: `Buy a print of ${art.title} by ${name}. Free US shipping, made to order.`,
    alternates: { canonical: url },
    openGraph: { title: `${art.title} by ${name}`, url, images: art.imageUrl ? [{ url: art.imageUrl }] : undefined },
  };
}

export default async function ArtPage({ params, searchParams }: Props) {
  // A printed code's ?off= counts when signed; old unsigned cards get up to 10% for a while (lib/scanSign.ts).
  const offRaw = parseDiscount(searchParams.off);
  const scan = scanDiscount(decodeURIComponent(params.art), offRaw, parseVenue(searchParams.at), searchParams.s);
  const scanPct = scan.pct;
  const [art, user] = await Promise.all([loadArt(params.art), getUserFromCookie()]);
  const isOwner = !!user && !!art && (user.id === art.artistId || user.role === "ADMIN");
  // Buyers only see approved work; the artist and admins can preview anything.
  if (!art || (art.status !== "APPROVED" && !isOwner)) notFound();
  // A suspended or closed artist's page is offline (admins can still look).
  if ((art.artist.closedAt || art.artist.suspendedAt) && user?.role !== "ADMIN") notFound();
  // Wrong or old handle (renamed artist): send to the right one, query string and all.
  if (decodeURIComponent(params.slug) !== art.artist.slug) permanentRedirect(withQuery(artPath(art.artist.slug, art.slug!), searchParams));

  // Short link (?c=K7P2 from /q/K7P2): venue and discount come from the code's DB record, so they're trusted.
  // An artist-page code scanned earlier (cookie) still counts on that artist's other pieces.
  const qr = await codeForArt(searchParams.c, cookies().get(CODE_COOKIE)?.value, art);
  const venue = qr ? qr.venue : parseVenue(searchParams.at);
  const pct = qr ? qr.discountPct ?? 0 : scanPct;

  const trustP = getArtistTrust(art.artistId);
  const factsP = imageFacts(art.imageUrl);
  const moreRows = await prisma.artwork.findMany({
    where: { artistId: art.artistId, id: { not: art.id }, status: "APPROVED", slug: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { slug: true, title: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true, printableSizes: true },
  });

  // This piece's reviews; with fewer than 3, show all of the artist's reviews instead.
  const pieceReviews = await getReviews({ artworkId: art.id }, 12);
  const reviews = pieceReviews.summary.count >= 3
    ? { ...pieceReviews, scope: "art" as const }
    : { ...(await getReviews({ artistId: art.artistId }, 12)), scope: "artist" as const };

  const edition = art.editionSize ? editionOf(art.editionSize, await soldCount(art.id)) : null;
  const a = art.artist;
  const place = [a.city, a.state].filter(Boolean).join(", ") || null;
  const accent = paint(parseTheme(a.pageTheme).accent);
  const facts = await factsP;
  const ownerNote = art.status === "APPROVED" ? null : art.status === "REJECTED" ? "not approved" : "in review";

  return (
    <>
      <SiteHeader
        brand={{
          handle: a.slug,
          name: a.artist_name || a.name,
          avatar: a.profileImage || null,
          accent: { color: accent.color, ink: accent.ink, soft: accent.soft },
          owner: isOwner ? { href: `/api/artworks/${encodeURIComponent(art.slug!)}/qr?download=1`, note: ownerNote } : null,
        }}
      />
      <ViewBeacon artistId={a.id} artworkId={art.id} />
    <ScanView
      art={{
        id: art.id,
        slug: art.slug!,
        title: art.title,
        description: art.description,
        imageUrl: art.imageUrl,
        sensitive: art.sensitive ?? [],
        approved: art.status === "APPROVED",
        markupSmall: art.markupSmall ?? 0,
        markupMedium: art.markupMedium ?? 0,
        markupLarge: art.markupLarge ?? 0,
        markupXl: art.markupXl ?? 0,
        edition,
        roomScenes: art.roomScenes ?? [],
        printableSizes: art.printableSizes ?? [],
      }}
      artist={{ id: a.id, slug: a.slug, name: a.artist_name || a.name, avatar: a.profileImage || null, place }}
      more={moreRows.map((m) => ({
        slug: m.slug!,
        title: m.title,
        imageUrl: m.imageUrl,
        sensitive: m.sensitive ?? [],
        fromCents: priceFor(m, PRINT_SIZES.find((sz) => m.printableSizes?.includes(sz)) ?? "small").list, // cheapest printable size
      }))}
      venue={venue}
      venueHref={qr?.venuePartner?.active ? `/venues/${qr.venuePartner.slug}` : null}
      pct={pct}
      sig={!qr && scanPct && !scan.legacy ? String(searchParams.s) : null}
      discountEnded={!qr && scan.ended}
      code={qr?.code ?? null}
      isOwner={isOwner}
      trust={await trustP}
      artistSplit={getArtistSplitFor({ orderDate: new Date(), proUntil: a.proUntil })}
      arrives={deliveryRange()}
      reviews={reviews}
      rooms={galleryRooms({ slug: art.slug!, roomScenes: art.roomScenes })}
      details={facts.details}
      aspect={facts.aspect}
    />
    </>
  );
}
