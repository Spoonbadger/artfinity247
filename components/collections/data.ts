// Public collection data: only approved work is shown, in the artist's order.
import { prisma } from "@/lib/prisma";
import { basePrices } from "@/lib/artwork_price";

const workSelect = { id: true, slug: true, title: true, imageUrl: true, sensitive: true, status: true, markupSmall: true, editionSize: true } as const;

export type PublicWork = { id: string; slug: string; title: string; imageUrl: string; sensitive: string[]; fromCents: number; editionSize: number | null };
export type PublicCollectionCard = { id: string; slug: string; title: string; description: string; count: number; cover: PublicWork | null; peek: PublicWork[] };

function findArtist(slug: string) {
  return prisma.artist.findFirst({
    where: { slug: { equals: decodeURIComponent(slug), mode: "insensitive" }, closedAt: null },
    select: { id: true, slug: true, name: true, artist_name: true, profileImage: true, city: true },
  });
}

const toWork = (a: { id: string; slug: string | null; title: string; imageUrl: string; sensitive: string[]; markupSmall: number | null; editionSize: number | null }): PublicWork => ({
  id: a.id, slug: a.slug!, title: a.title, imageUrl: a.imageUrl, sensitive: a.sensitive ?? [], fromCents: basePrices.small + (a.markupSmall ?? 0), editionSize: a.editionSize ?? null,
});

async function loadCollections(artistId: string) {
  const rows = await prisma.collection.findMany({
    where: { artistId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, slug: true, title: true, description: true, coverArtworkId: true,
      items: { orderBy: { position: "asc" }, select: { artwork: { select: workSelect } } },
    },
  });
  return rows
    .map((c) => {
      const works = c.items.map((i) => i.artwork).filter((a) => a.status === "APPROVED" && a.slug).map(toWork);
      const cover = works.find((w) => w.id === c.coverArtworkId) ?? works[0] ?? null;
      return { id: c.id, slug: c.slug, title: c.title, description: c.description ?? "", works, cover };
    })
    .filter((c) => c.works.length > 0);
}

/** Collections that have at least one public piece, for the artist page tab. */
export async function getPublicCollections(artistSlug: string): Promise<PublicCollectionCard[]> {
  const artist = await findArtist(artistSlug);
  if (!artist) return [];
  return (await loadCollections(artist.id)).map(({ works, ...c }) => ({
    ...c,
    count: works.length,
    peek: works.filter((w) => w.id !== c.cover?.id).slice(0, 2),
  }));
}

export async function getPublicCollection(artistSlug: string, collectionSlug: string) {
  const artist = await findArtist(artistSlug);
  if (!artist) return null;
  const all = await loadCollections(artist.id);
  const i = all.findIndex((c) => c.slug === decodeURIComponent(collectionSlug).toLowerCase());
  if (i < 0) return null;
  const pick = (c: (typeof all)[number] | undefined) => (c ? { slug: c.slug, title: c.title, cover: c.cover } : null);
  return {
    artist: { id: artist.id, slug: artist.slug, name: artist.artist_name || artist.name, avatar: artist.profileImage, city: artist.city },
    collection: all[i],
    prev: pick(all[i - 1]),
    next: pick(all[i + 1]),
    total: all.length,
    index: i,
  };
}
