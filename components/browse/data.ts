import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePrices } from "@/lib/artwork_price";
import { priceBand, PRINT_SIZE_KEYS, type ArtSort, type ArtistSort } from "./sortOptions";
import { cityLabel, placeName } from "@/lib/citySlug";

/** Public listings never show rejected work. */
// Only approved work is public (matches the public APIs and the scan page).
export const PUBLIC_ART: Prisma.ArtworkWhereInput = { status: "APPROVED", slug: { not: null }, artist: { closedAt: null, suspendedAt: null } };

const artSelect = {
  id: true, slug: true, title: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, createdAt: true, editionSize: true,
  artist: { select: { name: true, artist_name: true, slug: true, city: true, state: true, citySlug: true } },
} satisfies Prisma.ArtworkSelect;

type ArtRow = Prisma.ArtworkGetPayload<{ select: typeof artSelect }>;

export type CardArt = {
  id: string; slug: string; title: string; imageUrl: string; sensitive: string[]; priceFrom: number;
  editionSize?: number | null; // limited print run (null = open edition)
  artist: { name: string; slug: string; city: string };
};

export const displayName = (a: { artist_name?: string | null; name: string }) => a.artist_name?.trim() || a.name;
export { cityLabel };

export function toCard(a: ArtRow): CardArt {
  return {
    id: a.id, slug: a.slug!, title: a.title, imageUrl: a.imageUrl, sensitive: a.sensitive ?? [],
    priceFrom: basePrices.small + (a.markupSmall ?? 0),
    editionSize: a.editionSize ?? null,
    artist: { name: displayName(a.artist), slug: a.artist.slug, city: cityLabel(a.artist) },
  };
}

export { ART_SORTS, artSort, PRICE_BANDS, priceBand, PRINT_SIZE_KEYS, ARTIST_SORTS, artistSort } from "./sortOptions";
export type { ArtSort, PriceBand, ArtistSort } from "./sortOptions";

export async function getArt(opts: { city?: string; q?: string; sort?: ArtSort; page?: number; perPage?: number; artistSlug?: string; price?: string; minCents?: number; maxCents?: number; verified?: boolean; size?: string } = {}) {
  const { city, q, sort = "newest", page = 1, perPage = 24, artistSlug, price, size, verified } = opts;
  const where: Prisma.ArtworkWhereInput = { ...PUBLIC_ART };
  const and: Prisma.ArtworkWhereInput[] = [];
  const artist: Prisma.ArtistWhereInput = {};
  if (city) artist.citySlug = city;
  if (artistSlug) artist.slug = artistSlug;
  if (verified) artist.verification = "VERIFIED";
  if (Object.keys(artist).length) where.artist = { is: { ...artist, closedAt: null, suspendedAt: null } };
  if (q) {
    and.push({ OR: [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { artist: { is: { OR: [{ name: { contains: q, mode: "insensitive" } }, { artist_name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }] } } },
    ] });
  }
  // Starting price range, in cents, both ends included. A named band (?price=under-50, from older links) counts too.
  let lo = opts.minCents, hi = opts.maxCents;
  const band = priceBand(price);
  if (band && lo == null && hi == null) {
    if ("min" in band) lo = band.min;
    if ("max" in band) hi = band.max - 1;
  }
  if (lo != null || hi != null) {
    // priceFrom = small base price + small markup (a missing markup counts as 0)
    const markup: Prisma.IntNullableFilter = {};
    if (lo != null) markup.gte = lo - basePrices.small;
    if (hi != null) markup.lte = hi - basePrices.small;
    const zeroFits = (lo == null || lo <= basePrices.small) && (hi == null || hi >= basePrices.small);
    and.push(zeroFits ? { OR: [{ markupSmall: markup }, { markupSmall: null }] } : { markupSmall: markup });
  }
  if (size && (PRINT_SIZE_KEYS as string[]).includes(size)) {
    // Sharp enough for that size; older uploads were never checked, so they count.
    and.push({ OR: [{ printableSizes: { has: size } }, { printableSizes: { isEmpty: true } }] });
  }
  if (and.length) where.AND = and;
  const orderBy: Prisma.ArtworkOrderByWithRelationInput[] =
    sort === "price-asc" ? [{ markupSmall: "asc" }, { createdAt: "desc" }]
    : sort === "price-desc" ? [{ markupSmall: "desc" }, { createdAt: "desc" }]
    : sort === "popular" ? [{ OrderItem: { _count: "desc" } }, { createdAt: "desc" }]
    : [{ createdAt: "desc" }];
  const [rows, total] = await Promise.all([
    prisma.artwork.findMany({ where, orderBy, skip: (page - 1) * perPage, take: perPage, select: artSelect }),
    prisma.artwork.count({ where }),
  ]);
  return { art: rows.map(toCard), total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Places (NYC neighborhoods and cities elsewhere) that have public art, biggest first. `name` adds the state outside New York ("Austin, TX"). */
export async function getCities() {
  const rows = await prisma.artist.findMany({
    where: { citySlug: { not: "" }, artworks: { some: PUBLIC_ART } },
    select: { city: true, state: true, citySlug: true, _count: { select: { artworks: { where: PUBLIC_ART } } } },
  });
  const map = new Map<string, { slug: string; name: string; label: string; artists: number; pieces: number }>();
  for (const r of rows) {
    const e = map.get(r.citySlug);
    if (e) { e.artists++; e.pieces += r._count.artworks; }
    else map.set(r.citySlug, { slug: r.citySlug, name: placeName(r), label: cityLabel(r), artists: 1, pieces: r._count.artworks });
  }
  return Array.from(map.values()).sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name));
}

/** Artists with public work, with their newest few pieces. */
export async function getArtists(opts: { take?: number; city?: string; q?: string; pieces?: number; sort?: ArtistSort; verified?: boolean } = {}) {
  const { take, city, q, pieces = 3, sort = "popular", verified } = opts;
  const where: Prisma.ArtistWhereInput = { role: "USER", artworks: { some: PUBLIC_ART } };
  if (city) where.citySlug = city;
  if (verified) where.verification = "VERIFIED";
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { artist_name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }];
  const rows = await prisma.artist.findMany({
    where, take: sort === "az" ? undefined : take,
    select: {
      slug: true, name: true, artist_name: true, city: true, state: true, citySlug: true, profileImage: true, bio: true,
      _count: { select: { artworks: { where: PUBLIC_ART } } },
      artworks: { where: PUBLIC_ART, orderBy: { createdAt: "desc" }, take: pieces, select: { slug: true, title: true, imageUrl: true, sensitive: true } },
    },
    orderBy: sort === "newest" ? { createdAt: "desc" } : { artworks: { _count: "desc" } },
  });
  const list = rows.map((r) => ({
    slug: r.slug, name: displayName(r), city: cityLabel(r), citySlug: r.citySlug, avatar: r.profileImage, bio: r.bio || "",
    count: r._count.artworks, art: r.artworks.map((a) => ({ ...a, slug: a.slug!, sensitive: a.sensitive ?? [] })),
  }));
  // A to Z goes by the name people see (artist_name or name), so it's sorted here.
  if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return take && sort === "az" ? list.slice(0, take) : list;
}
export type DirArtist = Awaited<ReturnType<typeof getArtists>>[number];
