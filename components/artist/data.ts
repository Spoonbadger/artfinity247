import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { basePrices, getFinalPrice } from "@/lib/artwork_price";
import { getArtistTrust, type Trust } from "@/lib/artistTrust";
import { parseTheme, paint, type PageTheme } from "./theme";

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
  /** Medal, prints sold and real verification (Artist.verification === "VERIFIED"). */
  trust: Trust;
  /** Saved page design, with defaults filled in. */
  theme: PageTheme;
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
      pageTheme: true,
      closedAt: true,
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
  // A closed account's page is offline.
  if (!artist || artist.closedAt) return null;

  // Paid prints per artwork (sum of quantities on paid orders).
  const soldRows = await prisma.orderItem.groupBy({
    by: ["artworkId"],
    where: { artwork: { artistId: artist.id }, order: { paymentStatus: "paid", kind: { not: "bulk" } } },
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

  const theme = parseTheme(artist.pageTheme, works.map((w) => w.id));
  const trust = await getArtistTrust(artist.id);

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
    trust,
    theme,
    banner: resolveBanner(works, theme),
  };
});

/**
 * The banner picture for a theme: the piece the artist chose, nothing for a solid paint banner,
 * else the best-selling piece that isn't marked sensitive (also used for og:image).
 */
export function resolveBanner(works: ArtistWork[], theme: PageTheme): ArtistWork | null {
  if (theme.banner.kind === "color") return null;
  if (theme.banner.kind === "art") {
    const id = theme.banner.artworkId;
    const chosen = works.find((w) => w.id === id);
    if (chosen) return chosen;
  }
  const safe = works.filter((w) => w.sensitive.length === 0);
  return [...safe].sort((a, b) => b.sold - a.sold)[0] ?? null;
}

/** Solid paint color for the banner, when the theme asks for one. */
export function bannerColor(theme: PageTheme) {
  return theme.banner.kind === "color" ? paint(theme.banner.paint).color : null;
}

export type ArtistVenue = { name: string; when: string };

const fmtDay = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" });
};

/** Upcoming and current events from the artist's Studio (StudioEvent), soonest first. */
export async function venuesFor(artistId: string, now = new Date()): Promise<ArtistVenue[]> {
  const today = now.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const rows = await prisma.studioEvent.findMany({
    where: { artistId, end: { gte: today } },
    orderBy: [{ start: "asc" }, { createdAt: "asc" }],
    take: 5,
    select: { name: true, venue: true, start: true, end: true },
  });
  return rows.map((e) => ({
    name: e.venue ? `${e.name}, ${e.venue}` : e.name,
    when: e.start <= today ? "On now" : e.end !== e.start ? `${fmtDay(e.start)} to ${fmtDay(e.end)}` : fmtDay(e.start),
  }));
}

export function money(cents: number) {
  return "$" + (cents / 100).toFixed(2);
}
