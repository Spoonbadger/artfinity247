import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
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
      sub="Group pieces into series buyers can browse."
    >
      {arts.length === 0 ? (
        <EmptyState
          dab="#c98a5a"
          title="Upload art first"
          body="Then group it into series, places or seasons."
          action={{ label: "Upload art", href: "/studio/art/new" }}
          help={{ label: "How collections work", href: "/help/selling/collections" }}
        />
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
