// Server-only loaders for the link-in-bio page and the artist page's social icons.
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { isSocialKind, readTheme, type LinksArt, type LinksPageData } from "./model";

const artSelect = { id: true, slug: true, title: true, imageUrl: true, sensitive: true } as const;

/** Paid prints sold (sum of quantities), the number medals are based on. */
async function printsSold(artistId: string) {
  const r = await prisma.orderItem.aggregate({
    where: { artwork: { artistId }, order: { paymentStatus: "paid", kind: { not: "bulk" } } },
    _sum: { quantity: true },
  });
  return r._sum.quantity ?? 0;
}

async function findArtist(rawSlug: string) {
  const slug = decodeURIComponent(rawSlug).replace(/^@/, "").trim();
  if (!slug || !/^[\w.-]+$/.test(slug)) return null;
  const select = {
    id: true, slug: true, name: true, artist_name: true, city: true, state: true, bio: true,
    profileImage: true, verification: true, linksTheme: true,
  } as const;
  return (
    (await prisma.artist.findFirst({ where: { slug, closedAt: null }, select })) ??
    (await prisma.artist.findFirst({ where: { slug: { equals: slug, mode: "insensitive" }, closedAt: null }, select }))
  );
}

export const getLinksPage = cache(async (rawSlug: string): Promise<LinksPageData | null> => {
  const artist = await findArtist(rawSlug);
  if (!artist) return null;

  const [links, works, sold] = await Promise.all([
    prisma.artistLink.findMany({
      where: { artistId: artist.id, active: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, kind: true, label: true, url: true },
    }),
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: "APPROVED" },
      orderBy: { createdAt: "desc" },
      select: artSelect,
    }),
    printsSold(artist.id),
  ]);

  const theme = readTheme(artist.linksTheme);
  const all: LinksArt[] = works.map((w) => ({ ...w, sensitive: w.sensitive ?? [] }));
  const safe = all.filter((w) => w.sensitive.length === 0);

  // Background: the artist's pick (even if sensitive; the page blurs it for viewers who haven't opted in).
  // No pick, or the pick is gone: their newest piece that isn't marked sensitive.
  const chosen = theme.bgArtworkId ? all.find((w) => w.id === theme.bgArtworkId) ?? null : null;
  const background = chosen ?? safe[0] ?? null;

  // Shop tiles: three newest, safe pieces first so the funnel isn't a wall of blurred squares.
  const tiles = [...safe, ...all.filter((w) => w.sensitive.length > 0)].slice(0, 3);
  tiles.sort((a, b) => all.indexOf(a) - all.indexOf(b));

  const name = artist.artist_name || artist.name;
  return {
    slug: artist.slug,
    name,
    bio: (artist.bio || "").trim(),
    city: [artist.city, artist.state].filter(Boolean).join(", "),
    avatar: artist.profileImage,
    printsSold: sold,
    verified: artist.verification === "VERIFIED",
    links,
    tiles,
    background,
    theme,
  };
});

/** Approved artworks for the Studio background picker. */
export async function getPickableArt(artistId: string) {
  const works = await prisma.artwork.findMany({
    where: { artistId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    select: artSelect,
  });
  return works.map((w) => ({ ...w, sensitive: w.sensitive ?? [] }));
}

/**
 * Social links for the artist page header. Pass the result to <ArtistSocials links={...} />.
 * Only active links whose kind is a social network, website or email.
 */
export async function getArtistSocials(artistId: string) {
  const links = await prisma.artistLink.findMany({
    where: { artistId, active: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, kind: true, label: true, url: true },
  });
  return links.filter((l) => isSocialKind(l.kind));
}
