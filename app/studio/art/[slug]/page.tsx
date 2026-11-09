import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, Eye, Image as ImageIcon, QrCode } from "lucide-react";
import ArtworkForm from "@/components/studio/ArtworkForm";
import { StudioPage } from "@/components/studio/StudioPage";
import { MoreMenu } from "@/components/studio/MoreMenu";
import DeleteArtwork from "@/components/studio/DeleteArtwork";
import { prisma } from "@/lib/prisma";
import { artPath } from "@/lib/urls";
import { artistSplitNow, getSales, requireArtist, usd } from "../../_lib/data";
import { soldCount } from "@/lib/editions";
import { formLabels, latestLabels } from "@/lib/labelStatus";
import { partnerChoices, placeOptions } from "@/lib/artistPlaces";
import HangingCard from "@/components/places/HangingCard";

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
  const [sold, split, sales, scans, labels, places, partners, hangs] = await Promise.all([
    soldCount(id),
    artistSplitNow(artist.id),
    getSales(artist.id),
    prisma.scanEvent.count({ where: { qrCode: { artworkId: id } } }),
    // Printed labels of this piece's codes: the form warns before a price or title change makes them wrong.
    latestLabels(artist.id, { artworkId: id }),
    placeOptions(artist.id),
    partnerChoices(artist.id),
    prisma.hanging.findMany({ where: { artworkId: id }, orderBy: { startedAt: "desc" }, take: 8, select: { id: true, startedAt: true, endedAt: true, place: { select: { id: true, name: true } } } }),
  ]);
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
  const now = hangs.find((h) => !h.endedAt);
  const earned = sales.filter((s) => s.slug === art.slug).reduce((n, s) => n + s.shareCents, 0);
  const stats = [sold ? `${sold} sold` : "No sales yet", earned ? `${usd(earned)} earned` : "", scans ? `${scans} ${scans === 1 ? "scan" : "scans"}` : ""].filter(Boolean).join(" · ");
  return (
    <StudioPage
      title={art.title}
      sub={stats}
      actions={
        <>
          <MoreMenu
            items={[
              { label: "Print its QR code", href: `/studio/qr?art=${art.slug}`, icon: <QrCode /> },
              { label: "Rooms", href: `/studio/rooms?art=${encodeURIComponent(art.slug)}`, icon: <ImageIcon />, hint: "Pick the walls buyers see it on" },
              { label: "Download original", href: `/api/studio/originals/${id}`, icon: <Download />, external: true },
            ]}
          />
          <a href={artPath(artist.slug, art.slug)} target="_blank" rel="noopener" className="btn btn-ghost" title="View live page">
            <Eye className="h-4 w-4" aria-hidden="true" />Live page
          </a>
        </>
      }
    >
      <ArtworkForm artwork={{ ...rest, slug: art.slug, sold }} split={split} handle={artist.slug} printedLabels={formLabels(labels)} />
      <HangingCard
        artworkId={id} title={art.title} current={now ? now.place : null} places={places} partners={partners}
        history={hangs.map((h) => ({ id: h.id, place: h.place.name, placeId: h.place.id, from: day(h.startedAt), to: h.endedAt ? day(h.endedAt) : null }))}
      />
      <DeleteArtwork slug={art.slug} title={art.title} sold={sold} />
    </StudioPage>
  );
}
