import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import CollectionsManager from "@/components/collections/CollectionsManager";
import { listStudioCollections } from "@/components/collections/server";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const artist = await requireArtist("/studio/collections");
  const [collections, arts] = await Promise.all([
    listStudioCollections(artist.id),
    prisma.artwork.findMany({
      where: { artistId: artist.id, slug: { not: null }, status: { not: "REJECTED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, imageUrl: true, status: true },
    }),
  ]);

  return (
    <StudioPage
      title="Collections"
      sub="Group your work. Sort it your way."
      actions={<Link href={`/@${artist.slug}`} className="btn btn-ghost">View my page</Link>}
    >
      {arts.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">Upload a piece first.</h2>
          <Link href="/studio/art/new" className="btn btn-blue">Upload art</Link>
        </div>
      ) : (
        <CollectionsManager
          artistSlug={artist.slug}
          initial={collections}
          arts={arts.map((a) => ({ id: a.id, slug: a.slug!, title: a.title, imageUrl: a.imageUrl, live: a.status === "APPROVED" }))}
        />
      )}
    </StudioPage>
  );
}
