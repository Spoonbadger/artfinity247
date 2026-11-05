// The site header on an artist's pages (/@handle, its paintings and collections): the artist's name
// sits where the wordmark goes, like a storefront. Rendered by the @header slot in app/(landing).
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import SiteHeader, { type HeaderBrand } from "@/components/site/SiteHeader";

const getBrand = cache(async (raw: string): Promise<HeaderBrand | null> => {
  const handle = decodeURIComponent(raw).replace(/^@/, "").trim();
  if (!handle || !/^[\w.-]+$/.test(handle)) return null;
  const select = { slug: true, name: true, artist_name: true, profileImage: true, closedAt: true } as const;
  const a =
    (await prisma.artist.findUnique({ where: { slug: handle }, select })) ??
    (await prisma.artist.findFirst({ where: { slug: { equals: handle, mode: "insensitive" } }, select }));
  if (!a || a.closedAt) return null;
  return { handle: a.slug, name: (a.artist_name || a.name).trim(), avatar: a.profileImage || null };
});

export default async function ArtistHeader({ handle }: { handle: string }) {
  const brand = await getBrand(handle).catch(() => null);
  return <SiteHeader brand={brand} />;
}
