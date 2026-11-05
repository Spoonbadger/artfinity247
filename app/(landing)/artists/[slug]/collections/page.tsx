import type { Metadata } from "next";
import { previewImage, sharePreview } from "@/lib/og";
import { collectionsPath, SITE_URL } from "@/lib/urls";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import { prisma } from "@/lib/prisma";
import CollectionsTab from "@/components/collections/CollectionsTab";
import { getPublicCollections } from "@/components/collections/data";
import { BrushStroke } from "@/components/af/Brush";
import ViewBeacon from "@/components/analytics/ViewBeacon";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function artistOf(slug: string) {
  return prisma.artist.findFirst({ where: { slug: { equals: decodeURIComponent(slug), mode: "insensitive" }, closedAt: null, suspendedAt: null }, select: { id: true, slug: true, name: true, artist_name: true, profileImage: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await artistOf(params.slug).catch(() => null);
  if (!a) return { title: "Collections" };
  const name = a.artist_name || a.name;
  const cols = await getPublicCollections(a.slug).catch(() => []);
  const title = `Collections by ${name}`;
  const description = cols.length ? `${cols.map((c) => c.title).slice(0, 3).join(", ")}. Prints by ${name}, free US shipping.` : `Prints by ${name}, free US shipping.`;
  const image = previewImage(...cols.flatMap((c) => [c.cover, ...c.peek]).map((w) => w && { url: w.imageUrl, alt: `${w.title}, by ${name}`, sensitive: w.sensitive }), { url: a.profileImage, alt: name });
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical: collectionsPath(a.slug) },
    ...sharePreview({ title, description, url: collectionsPath(a.slug), image }),
  };
}

/** All of an artist's collections: /artists/<handle>/collections (and /@handle/collections once rewritten). */
export default async function ArtistCollectionsPage({ params }: Props) {
  const artist = await artistOf(params.slug);
  if (!artist) notFound();
  const collections = await getPublicCollections(artist.slug);
  const name = artist.artist_name || artist.name;
  return (
    <>
      <SiteHeader brand={{ handle: artist.slug, name, avatar: artist.profileImage || null }} />
      <ViewBeacon artistId={artist.id} />
    <div className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
      <header>
        <h1 className="display text-[52px] sm:text-[80px]">Collections</h1>
        <BrushStroke className="mt-1 h-3 w-44" />
      </header>
      <CollectionsTab artistSlug={artist.slug} collections={collections} />
    </div>
    </>
  );
}
