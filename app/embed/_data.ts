// Data for the artist and collection embeds. Only what the public API already shows: approved pieces of open
// accounts, the public display name (never the legal name), city, medal (only when the artist shows it), prices.
import { prisma } from "@/lib/prisma";
import { getArtistTrust } from "@/lib/artistTrust";
import { cityLabel } from "@/lib/citySlug";
import { artistUrl, collectionUrl } from "@/lib/urls";
import { parseTheme } from "@/components/artist/theme";
import {
  PUBLIC_ARTWORK, absUrl, artworkSelect, displayName, editionSales, serializeArtwork, serializeMedal, type ArtworkRow,
} from "@/components/devtools/publicApi";
import type { EmbedView, EmbedWork } from "@/lib/embed/render";

/** Route params, decoded; a malformed escape gives "" (and so a 404), never a throw. */
export function param(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

const artistSelect = {
  id: true, slug: true, name: true, artist_name: true, profileImage: true, city: true, state: true, pageTheme: true,
} as const;

/** Exact handle first, then any case (people type /@MayaOkafor). Closed and suspended accounts are offline. */
export async function findEmbedArtist(handle: string) {
  const h = handle.replace(/^@/, "").trim();
  if (!/^[\w.-]{1,64}$/.test(h)) return null;
  const open = { closedAt: null, suspendedAt: null };
  return (
    (await prisma.artist.findFirst({ where: { slug: h, ...open }, select: artistSelect })) ??
    (await prisma.artist.findFirst({ where: { slug: { equals: h, mode: "insensitive" }, ...open }, select: artistSelect }))
  );
}

type Artist = NonNullable<Awaited<ReturnType<typeof findEmbedArtist>>>;

/** Artwork links carry ?src=embed, like the single-artwork card, so visits from embeds show up in stats. */
function tagged(url: string) {
  const u = new URL(url);
  u.searchParams.set("src", "embed");
  return u.toString();
}

async function works(base: string, rows: ArtworkRow[]): Promise<EmbedWork[]> {
  const sold = await editionSales(prisma, rows);
  return rows.map((r) => {
    const a = serializeArtwork(base, r, sold.get(r.id) ?? 0);
    return { title: a.title, url: tagged(a.url), imageUrl: a.image.url, sensitive: a.sensitive, price: a.fromPrice.display, edition: a.edition };
  });
}

async function head(base: string, a: Artist) {
  const trust = await getArtistTrust(a.id);
  return {
    name: displayName(a),
    url: artistUrl(a.slug, base),
    avatar: a.profileImage ? absUrl(base, a.profileImage) : null,
    location: cityLabel(a),
    verified: trust.verified,
    medal: serializeMedal(trust)?.label ?? null,
  };
}

/** The artist's pinned pieces first (as on their page), then the newest. */
export async function loadArtistEmbed(handle: string, count: number, base: string) {
  const a = await findEmbedArtist(handle);
  if (!a) return null;
  const theme = parseTheme(a.pageTheme);
  const where = { ...PUBLIC_ARTWORK, artistId: a.id };
  const [pinnedRows, newest, total, artist] = await Promise.all([
    theme.pinned.length ? prisma.artwork.findMany({ where: { ...where, id: { in: theme.pinned } }, select: artworkSelect }) : Promise.resolve([]),
    prisma.artwork.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: count + theme.pinned.length, select: artworkSelect }),
    prisma.artwork.count({ where }),
    head(base, a),
  ]);
  const pinned = theme.pinned.map((id) => pinnedRows.find((r) => r.id === id)).filter((r): r is ArtworkRow => !!r);
  const rows = [...pinned, ...newest.filter((r) => !pinned.some((p) => p.id === r.id))].slice(0, count);
  const view: EmbedView = { artist, works: await works(base, rows), total, moreUrl: artist.url, homeUrl: base };
  return { view, pageAccent: theme.accent };
}

/** One collection's public pieces, in the artist's order. Collections with no public pieces are not shown. */
export async function loadCollectionEmbed(handle: string, slug: string, count: number, base: string) {
  const a = await findEmbedArtist(handle);
  if (!a || !/^[\w.-]{1,160}$/.test(slug)) return null;
  const col = await prisma.collection.findFirst({
    where: { artistId: a.id, slug: { equals: slug, mode: "insensitive" } },
    select: { id: true, slug: true, title: true, description: true },
  });
  if (!col) return null;
  const itemWhere = { collectionId: col.id, artwork: PUBLIC_ARTWORK };
  const [items, total, artist] = await Promise.all([
    prisma.collectionItem.findMany({ where: itemWhere, orderBy: [{ position: "asc" }, { id: "asc" }], take: count, select: { artwork: { select: artworkSelect } } }),
    prisma.collectionItem.count({ where: itemWhere }),
    head(base, a),
  ]);
  if (!total) return null;
  const url = collectionUrl(a.slug, col.slug, base);
  const view: EmbedView = {
    artist,
    collection: { title: col.title, description: (col.description || "").trim(), url },
    works: await works(base, items.map((i) => i.artwork)),
    total,
    moreUrl: url,
    homeUrl: base,
  };
  return { view, pageAccent: parseTheme(a.pageTheme).accent };
}
