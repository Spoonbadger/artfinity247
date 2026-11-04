import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePrices, getFinalPrice } from "@/lib/artwork_price";

export type ArtistWork = {
  id: string;
  slug: string | null;
  title: string;
  imageUrl: string;
  sensitive: string[];
  fromCents: number;
  sold: number;
};

export type ArtistPageData = {
  id: string;
  slug: string;
  name: string;
  firstName: string;
  city: string;
  bio: string;
  avatar: string | null;
  memberSince: Date;
  works: ArtistWork[];
  sales: number;
  verified: boolean;
  banner: ArtistWork | null;
};

type Size = keyof typeof basePrices;

/** Lowest price across the sizes, using each size's own markup. */
function lowestPrice(a: { markupSmall: number | null; markupMedium: number | null; markupLarge: number | null; markupXl: number | null }) {
  const markups: Record<Size, number> = {
    small: a.markupSmall ?? 0,
    medium: a.markupMedium ?? 0,
    large: a.markupLarge ?? 0,
    xl: a.markupXl ?? 0,
  };
  return Math.min(...(Object.keys(basePrices) as Size[]).map((s) => getFinalPrice(s, markups[s])));
}

export const getArtistPage = cache(async (rawSlug: string): Promise<ArtistPageData | null> => {
  const slug = decodeURIComponent(rawSlug).replace(/^@/, "").trim();
  if (!slug || !/^[\w.-]+$/.test(slug)) return null;

  const select = {
      id: true,
      slug: true,
      name: true,
      first_name: true,
      artist_name: true,
      city: true,
      state: true,
      bio: true,
      profileImage: true,
      createdAt: true,
      artworks: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          sensitive: true,
          markupSmall: true,
          markupMedium: true,
          markupLarge: true,
          markupXl: true,
        },
      },
  } satisfies Prisma.ArtistSelect;

  // Exact handle first; fall back to a case-insensitive match (/@MayaOkafor).
  const artist =
    (await prisma.artist.findUnique({ where: { slug }, select })) ??
    (await prisma.artist.findFirst({ where: { slug: { equals: slug, mode: "insensitive" } }, select }));
  if (!artist) return null;

  // Paid prints per artwork (sum of quantities on paid orders).
  const soldRows = await prisma.orderItem.groupBy({
    by: ["artworkId"],
    where: { artwork: { artistId: artist.id }, order: { paymentStatus: "paid" } },
    _sum: { quantity: true },
    _count: { _all: true },
  });
  const sold = new Map<string, number>(
    soldRows.map((r) => [r.artworkId ?? "", r._sum.quantity ?? r._count._all])
  );

  const works: ArtistWork[] = artist.artworks.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    imageUrl: a.imageUrl,
    sensitive: a.sensitive ?? [],
    fromCents: lowestPrice(a),
    sold: sold.get(a.id) ?? 0,
  }));

  const sales = soldRows.reduce((n, r) => n + (r._sum.quantity ?? r._count._all), 0);

  // Banner + og:image: the best-selling piece that isn't marked sensitive, else the newest safe one.
  const safe = works.filter((w) => w.sensitive.length === 0);
  const banner = [...safe].sort((a, b) => b.sold - a.sold)[0] ?? null;

  const name = artist.artist_name || artist.name;
  const city = [artist.city, artist.state].filter(Boolean).join(", ");

  return {
    id: artist.id,
    slug: artist.slug,
    name,
    firstName: artist.first_name || name.split(" ")[0],
    city,
    bio: (artist.bio || "").trim(),
    avatar: artist.profileImage,
    memberSince: artist.createdAt,
    works,
    sales,
    verified: sales > 0,
    banner,
  };
});

/**
 * Placeholder venues for the seeded demo artists until a venue model exists.
 * Real artists get no list, so the "See it in person" block is hidden for them.
 */
const SAMPLE_VENUES: Record<string, { name: string; when: string }[]> = {
  mayaokafor: [
    { name: "Lumen Café, West Asheville", when: "On now" },
    { name: "River Arts Market", when: "Sat and Sun" },
    { name: "Holiday Pop-up", when: "Dec 6" },
  ],
  junopark: [
    { name: "Cosmic Coffee", when: "On now" },
    { name: "East Austin Studio Tour", when: "Nov 15" },
  ],
  inesduarte: [{ name: "Canyon Road Market", when: "Fridays" }],
  calebmoreno: [{ name: "Heart Coffee, Burnside", when: "On now" }],
};

export function venuesFor(slug: string) {
  return SAMPLE_VENUES[slug.toLowerCase()] ?? [];
}

export function money(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}
