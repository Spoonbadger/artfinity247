import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CollectionsTab from "@/components/collections/CollectionsTab";
import { getPublicCollections } from "@/components/collections/data";
import { BrushStroke } from "@/components/af/Brush";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string } };

async function artistOf(slug: string) {
  return prisma.artist.findFirst({ where: { slug: { equals: decodeURIComponent(slug), mode: "insensitive" } }, select: { slug: true, name: true, artist_name: true } });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await artistOf(params.slug).catch(() => null);
  return { title: a ? `Collections by ${a.artist_name || a.name}` : "Collections" };
}

/** All of an artist's collections: /artists/<handle>/collections (and /@handle/collections once rewritten). */
export default async function ArtistCollectionsPage({ params }: Props) {
  const artist = await artistOf(params.slug);
  if (!artist) notFound();
  const collections = await getPublicCollections(artist.slug);
  const name = artist.artist_name || artist.name;
  return (
    <div className="mx-auto grid max-w-[1240px] gap-8 px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
      <header>
        <Link href={`/@${artist.slug}`} className="text-[15px] font-bold text-ink hover:underline">{name}</Link>
        <h1 className="display mt-2 text-[52px] sm:text-[80px]">Collections</h1>
        <BrushStroke className="mt-1 h-3 w-44" />
      </header>
      <CollectionsTab artistSlug={artist.slug} collections={collections} />
    </div>
  );
}
