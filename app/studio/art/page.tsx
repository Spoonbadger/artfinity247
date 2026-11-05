import Link from "next/link";
import ArtGrid from "@/components/studio/ArtGrid";
import { StudioPage } from "@/components/studio/StudioPage";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My art" };

export default async function MyArtPage() {
  const artist = await requireArtist("/studio/art");
  const art = await prisma.artwork.findMany({
    where: { artistId: artist.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, title: true, imageUrl: true, status: true, sensitive: true, flaggedReason: true, OrderItem: { where: { order: { paymentStatus: "paid", kind: { not: "bulk" } } }, select: { quantity: true } } },
  });
  const items = art
    .filter((a) => a.slug)
    .map(({ OrderItem, ...a }) => ({ ...a, slug: a.slug!, sold: OrderItem.reduce((n, o) => n + (o.quantity ?? 1), 0) }));
  const live = items.filter((a) => a.status === "APPROVED").length;
  const inReview = items.filter((a) => a.status === "PENDING").length;

  return (
    <StudioPage
      title="My art"
      sub={`${live} on your page${inReview ? ` · ${inReview} in review` : ""}`}
      actions={
        <>
          {live > 0 && (
            <a href="/api/artworks/qr/bulk" target="_blank" rel="noopener" className="btn btn-ghost" title="Gallery-label QR cards for every live piece, ready to print">
              Print all codes (PDF)
            </a>
          )}
          <Link href="/studio/collections" className="btn btn-ghost">Collections</Link>
          <Link href="/studio/bulk" className="btn btn-ghost">Order prints in bulk</Link>
          <Link href="/studio/art/new" className="btn btn-blue">Upload art</Link>
        </>
      }
    >
      <ArtGrid items={items} handle={artist.slug} />
    </StudioPage>
  );
}
