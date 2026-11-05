import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { artistUrl, artUrl, SITE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

const STATIC: [string, number][] = [
  ["/", 1],
  ["/art", 0.9],
  ["/artists", 0.9],
  ["/scenes", 0.7],
  ["/pricing", 0.7],
  ["/sell-with-us", 0.7],
  ["/about-us", 0.6],
  ["/developers", 0.5],
  ["/contact", 0.4],
  ["/report", 0.3],
  ["/dmca", 0.3],
  ["/return-policy", 0.3],
  ["/artist-terms-and-agreement", 0.2],
  ["/terms-and-conditions", 0.2],
  ["/privacy-policy", 0.2],
  ["/cookie-policy", 0.2],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [artworks, artists] = await Promise.all([
    prisma.artwork.findMany({
      where: { status: "APPROVED", slug: { not: null }, artist: { closedAt: null } },
      select: { slug: true, createdAt: true, artist: { select: { slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 45_000,
    }),
    prisma.artist.findMany({
      where: { closedAt: null, role: "USER", artworks: { some: { status: "APPROVED" } } },
      select: { slug: true, createdAt: true },
      take: 5_000,
    }),
  ]).catch(() => [[], []] as const);

  return [
    ...STATIC.map(([path, priority]) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, changeFrequency: "weekly" as const, priority })),
    ...artists.map((a) => ({ url: artistUrl(a.slug, SITE_URL), lastModified: a.createdAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...artworks.map((a) => ({ url: artUrl(a.artist.slug, a.slug!, SITE_URL), lastModified: a.createdAt, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
