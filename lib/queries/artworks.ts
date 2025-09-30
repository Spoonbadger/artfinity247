// lib/queries/artworks.ts
import { prisma } from "@/lib/prisma";

export async function getAllArtworks() {
  const artworks = await prisma.artwork.findMany({
    include: { artist: true },
    orderBy: { createdAt: "desc" },
  });

  return artworks.map((art) => ({
    id: art.id,
    slug: art.slug || "",
    title: art.title,
    description: art.description,
    imageUrl: art.imageUrl,
    seller: art.artistId,
    artistName: art.artist?.name || "",
  }));
}
