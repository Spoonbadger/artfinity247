import { verifyScan } from "@/lib/scanSign";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import ScanView from "@/components/art/ScanView";
import { getArtistTrust } from "@/lib/artistTrust";
import { parseDiscount, parseVenue, priceFor } from "@/components/art/pricing";
import { editionOf, soldCount } from "@/lib/editions";

export const dynamic = "force-dynamic";

// viewport-fit=cover so the sticky buy bar can sit above the iPhone home indicator
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

type Props = { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> };

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
  artist: { select: { id: true, slug: true, name: true, artist_name: true, profileImage: true, city: true, state: true } },
} as const;

async function loadArt(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug);
  return prisma.artwork.findUnique({ where: { slug }, select: artSelect });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const art = await loadArt(params.slug).catch(() => null);
  if (!art || art.status !== "APPROVED") return { title: "Artwork" };
  const name = art.artist.artist_name || art.artist.name;
  return {
    title: `${art.title} by ${name}`,
    description: `Buy a print of ${art.title} by ${name}. Free US shipping, made to order.`,
    openGraph: { title: `${art.title} by ${name}`, images: art.imageUrl ? [{ url: art.imageUrl }] : undefined },
  };
}

export default async function ArtPage({ params, searchParams }: Props) {
  // A discount from a printed code only counts when its signature matches (typed-in ?off= is ignored).
  const offRaw = parseDiscount(searchParams.off);
  const scanPct = offRaw && verifyScan(params.slug, offRaw, parseVenue(searchParams.at), searchParams.s) ? offRaw : 0;
  const [art, user] = await Promise.all([loadArt(params.slug), getUserFromCookie()]);
  const isOwner = !!user && !!art && (user.id === art.artistId || user.role === "ADMIN");
  // Buyers only see approved work; the artist and admins can preview anything.
  if (!art || (art.status !== "APPROVED" && !isOwner)) notFound();

  const trustP = getArtistTrust(art.artistId);
  const moreRows = await prisma.artwork.findMany({
    where: { artistId: art.artistId, id: { not: art.id }, status: "APPROVED", slug: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 8,
    select: { slug: true, title: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true },
  });

  const edition = art.editionSize ? editionOf(art.editionSize, await soldCount(art.id)) : null;
  const a = art.artist;
  const place = [a.city, a.state].filter(Boolean).join(", ") || null;

  return (
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
      }}
      artist={{ id: a.id, slug: a.slug, name: a.artist_name || a.name, avatar: a.profileImage || null, place }}
      more={moreRows.map((m) => ({
        slug: m.slug!,
        title: m.title,
        imageUrl: m.imageUrl,
        sensitive: m.sensitive ?? [],
        fromCents: priceFor(m, "small").list,
      }))}
      venue={parseVenue(searchParams.at)}
      pct={scanPct}
      sig={scanPct ? String(searchParams.s) : null}
      isOwner={isOwner}
      status={art.status}
      trust={await trustP}
    />
  );
}
