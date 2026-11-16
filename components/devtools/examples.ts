// Real example requests and responses for the docs, built from the same serializers the API uses.
import { prisma } from "@/lib/prisma";
import { getArtistTrust } from "@/lib/artistTrust";
import { getReviewSummary } from "@/lib/reviews";
import { encodeCursor } from "@/lib/apiCursor";
import { artistUrl, artUrl, collectionUrl } from "@/lib/urls";
import {
  PUBLIC_ARTWORK, absUrl, artistSelect, artworkSelect, displayName, editionSales, serializeArtist, serializeArtwork, siteBase, sizesFor,
} from "./publicApi";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => new Date(Date.now() + n * 86_400_000);

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
        // The first collection with a public piece (empty ones are hidden from the API).
        collections: {
          where: { items: { some: { artwork: PUBLIC_ARTWORK } } },
          orderBy: { position: "asc" },
          take: 1,
          select: {
            slug: true, title: true, description: true,
            _count: { select: { items: { where: { artwork: PUBLIC_ARTWORK } } } },
            items: { where: { artwork: PUBLIC_ARTWORK }, orderBy: [{ position: "asc" }, { id: "asc" }], take: 2, select: { id: true, position: true, artwork: { select: artworkSelect } } },
          },
        },
      },
    }),
    prisma.artwork.findMany({ where: { ...PUBLIC_ARTWORK, artistId: artist.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { ...artworkSelect, description: true, printableSizes: true } }),
    getArtistTrust(artist.id),
  ]);
  const today = ymd(new Date());
  const events = await prisma.studioEvent.findMany({
    where: { artistId: artist.id, end: { gte: today } },
    orderBy: [{ start: "asc" }, { createdAt: "asc" }],
    take: 2,
    select: { name: true, venue: true, start: true, end: true },
  });
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
  const first = col?.items[0];
  const colSold = first ? await editionSales(prisma, [first.artwork]) : new Map<string, number>();
  const collectionRes = col && first
    ? {
        collection: {
          slug: col.slug, title: col.title, description: col.description || "", url: collectionUrl(full.slug, col.slug, base), artworkCount: col._count.items,
          cover: { url: absUrl(base, first.artwork.imageUrl), alt: first.artwork.title, sensitive: first.artwork.sensitive },
          artist: { handle: full.slug, name: displayName(full), url: artistUrl(full.slug, base) },
        },
        artworks: [serializeArtwork(base, first.artwork, colSold.get(first.artwork.id) ?? 0)],
        nextCursor: col.items[1] ? encodeCursor({ k: first.position, id: first.id }) : null,
      }
    : null;
  // Real shows when the artist has some; otherwise an illustration of the shape.
  const eventsRes = {
    events: events.length
      ? events.map((e) => ({ name: e.name, venue: e.venue || null, start: e.start, end: e.end, onNow: e.start <= today }))
      : [{ name: "Open studio", venue: "Studio 4B", start: ymd(addDays(9)), end: ymd(addDays(10)), onNow: false }],
  };
  const searchWord = (pick.title.split(/\s+/).find((w) => w.replace(/\W/g, "").length >= 3) ?? pick.title).replace(/[^\p{L}\p{N}-]/gu, "").toLowerCase() || full.slug;
  const searchRes = {
    artworks: [serializeArtwork(base, pick, sold.get(pick.id) ?? 0)],
    nextCursor: encodeCursor({ k: pick.createdAt.getTime(), id: pick.id }),
  };

  return {
    base,
    handle: full.slug,
    name: displayName(full),
    artworkSlug: pick.slug!,
    artworkTitle: pick.title,
    sensitiveSlug: sensitive?.slug ?? null,
    collectionSlug: col?.slug ?? null,
    collectionTitle: col?.title ?? null,
    collectionCount: col?._count.items ?? 0,
    searchWord,
    artistRes, listRes, artworkRes, collectionsRes, collectionRes, eventsRes, searchRes,
  };
}

export type Examples = NonNullable<Awaited<ReturnType<typeof getExamples>>>;
