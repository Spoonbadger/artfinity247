import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { artistPath, artPath } from "@/lib/urls";
import { adminOrRedirect } from "../../../_components/gate";
import ArtworkEditForm from "../../../_components/ArtworkEditForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit artwork" };

export default async function AdminEditArtwork({ params }: { params: { id: string } }) {
  await adminOrRedirect(`/admin/artworks/${params.id}/edit`);
  const a = await prisma.artwork.findUnique({
    where: { id: params.id },
    select: {
      id: true, title: true, slug: true, description: true, imageUrl: true, status: true, sensitive: true,
      markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
      artist: { select: { slug: true, artist_name: true, name: true } },
    },
  });
  if (!a) notFound();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <Link href="/admin/moderation" className="text-[14px] font-semibold text-ink-2 hover:text-ink">← Moderation</Link>
        <h1 className="display text-[40px] sm:text-[52px]">Edit artwork</h1>
        <p className="text-[14px] text-ink-2">
          By <Link href={artistPath(a.artist.slug)} className="font-semibold text-ink hover:text-scan">{a.artist.artist_name || a.artist.name}</Link>
          {a.slug && <> · <Link href={artPath(a.artist.slug, a.slug)} className="font-semibold text-scan">View live</Link></>}
          {" · "}<a href={`/api/admin/originals/${a.id}`} className="font-semibold text-scan">Download original</a>
        </p>
      </div>
      <ArtworkEditForm
        artwork={{
          id: a.id,
          title: a.title,
          description: a.description,
          imageUrl: a.imageUrl,
          status: a.status,
          sensitive: a.sensitive ?? [],
          markupSmall: a.markupSmall ?? 0,
          markupMedium: a.markupMedium ?? 0,
          markupLarge: a.markupLarge ?? 0,
          markupXl: a.markupXl ?? 0,
        }}
      />
    </div>
  );
}
