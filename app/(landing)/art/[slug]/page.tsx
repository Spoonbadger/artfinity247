// Old artwork URL /art/<slug>. Printed QR codes and shared links point here, so it stays forever:
// a 308 to /@handle/art/<slug>, keeping the whole query string (?c=, ?off=&at=&s=, utm…).
import { notFound, permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { artPath, withQuery } from "@/lib/urls";

export const dynamic = "force-dynamic";

type Props = { params: { slug: string }; searchParams: Record<string, string | string[] | undefined> };

export default async function OldArtUrl({ params, searchParams }: Props) {
  const art = await prisma.artwork.findUnique({
    where: { slug: decodeURIComponent(params.slug) },
    select: { slug: true, artist: { select: { slug: true } } },
  });
  if (!art?.slug) notFound();
  permanentRedirect(withQuery(artPath(art.artist.slug, art.slug), searchParams));
}
