import { notFound } from "next/navigation";
import Link from "next/link";
import ArtworkForm from "@/components/studio/ArtworkForm";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { artistSplitNow, requireArtist } from "../../_lib/data";
import { soldCount } from "@/lib/editions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit art" };

export default async function EditArtPage({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug);
  const artist = await requireArtist(`/studio/art/${slug}`);
  const art = await prisma.artwork.findUnique({
    where: { slug },
    select: { id: true, slug: true, title: true, description: true, imageUrl: true, sensitive: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true, editionSize: true, printableSizes: true, imageEdits: true, artistId: true },
  });
  // Only the owner can edit; anyone else gets a 404 rather than a hint that it exists.
  if (!art || !art.slug || art.artistId !== artist.id) notFound();
  const { artistId, id, ...rest } = art;
  const [sold, split] = await Promise.all([soldCount(id), artistSplitNow(artist.id)]);
  return (
    <StudioPage
      title="Edit art"
      sub={art.title}
      actions={
        <>
          <Link href={`/studio/qr?art=${art.slug}`} className="btn btn-ghost btn-sm">Print code</Link>
          <a href={`/api/studio/originals/${id}`} className="btn btn-ghost btn-sm">Download original</a>
          <Link href={artPath(artist.slug, art.slug)} className="btn btn-ghost btn-sm">View</Link>
        </>
      }
    >
      <ArtworkForm artwork={{ ...rest, slug: art.slug, sold }} split={split} handle={artist.slug} />
    </StudioPage>
  );
}
