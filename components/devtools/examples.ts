// Real example requests and responses for the docs, built from the same serializers the API uses.
import { prisma } from "@/lib/prisma";
import { getArtistTrust } from "@/lib/artistTrust";
import { getReviewSummary } from "@/lib/reviews";
import { artUrl } from "@/lib/urls";
import {
  PUBLIC_ARTWORK, absUrl, artistSelect, artworkSelect, displayName, editionSales, serializeArtist, serializeArtwork, siteBase, sizesFor,
} from "./publicApi";

export async function getExamples() {
  const base = siteBase();
  const artist =
    (await prisma.artist.findFirst({ where: { slug: "mayaokafor", artworks: { some: PUBLIC_ARTWORK } }, select: { id: true, slug: true } })) ??
    (await prisma.artist.findFirst({ where: { artworks: { some: PUBLIC_ARTWORK } }, orderBy: { createdAt: "asc" }, select: { id: true, slug: true } }));
  if (!artist) return null;

  const [full, works, trust] = await Promise.all([
    prisma.artist.findUnique({
      where: { id: artist.id },
      select: {
        ...artistSelect,
        collections: { orderBy: { position: "asc" }, take: 1, select: { slug: true, title: true, description: true, _count: { select: { items: true } } } },
      },
    }),
    prisma.artwork.findMany({ where: { ...PUBLIC_ARTWORK, artistId: artist.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { ...artworkSelect, description: true } }),
    getArtistTrust(artist.id),
  ]);
  if (!full || !works.length) return null;

  const sold = await editionSales(prisma, works);
  // Prefer a safe-for-work limited edition for the single-artwork examples.
  const pick = works.find((w) => w.editionSize && !w.sensitive.length) ?? works.find((w) => !w.sensitive.length) ?? works[0];
  const sensitive = works.find((w) => w.sensitive.length) ?? null;
  const api = `${base}/api/public/v1/artists/${full.slug}`;
  const shown = serializeArtist(base, full, trust);
  const [artistRating, pickRating] = await Promise.all([getReviewSummary({ artistId: artist.id }), getReviewSummary({ artworkId: pick.id })]);
  const artistRes = { artist: { ...shown, links: shown.links.slice(0, 2), rating: artistRating.count ? artistRating.average : null, reviewCount: artistRating.count } };
  const listRes = { artworks: [serializeArtwork(base, works[0], sold.get(works[0].id) ?? 0)], nextCursor: works[1]?.id ?? null };
  const artworkRes = {
    artwork: { ...serializeArtwork(base, pick, sold.get(pick.id) ?? 0), description: pick.description || "", rating: pickRating.count ? pickRating.average : null, reviewCount: pickRating.count, sizes: sizesFor(pick).slice(0, 2), buyUrl: artUrl(pick.artist.slug, pick.slug!, base) },
  };
  const col = full.collections[0];
  const collectionsRes = {
    collections: col
      ? [{
          slug: col.slug, title: col.title, description: col.description || "", artworkCount: col._count.items,
          cover: { url: absUrl(base, works[0].imageUrl), alt: works[0].title, sensitive: [] as string[] },
          artworks: `${api}/artworks?collection=${col.slug}`,
        }]
      : [],
  };

  return {
    base,
    handle: full.slug,
    name: displayName(full),
    artworkSlug: pick.slug!,
    artworkTitle: pick.title,
    sensitiveSlug: sensitive?.slug ?? null,
    collectionSlug: col?.slug ?? null,
    artistRes, listRes, artworkRes, collectionsRes,
  };
}

export type Examples = NonNullable<Awaited<ReturnType<typeof getExamples>>>;
