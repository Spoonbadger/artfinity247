import Link from "next/link";
import { FileDown, Layers, Package, Upload } from "lucide-react";
import ArtGrid from "@/components/studio/ArtGrid";
import { StudioPage } from "@/components/studio/StudioPage";
import { MoreMenu, type MoreItem } from "@/components/studio/MoreMenu";
import { prisma } from "@/lib/prisma";
import { requireArtist } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My art" };

export default async function MyArtPage() {
  const artist = await requireArtist("/studio/art");
  const [art, codes] = await Promise.all([
    prisma.artwork.findMany({
      where: { artistId: artist.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, imageUrl: true, status: true, sensitive: true, flaggedReason: true, createdAt: true, OrderItem: { where: { order: { paymentStatus: "paid", kind: { not: "bulk" } } }, select: { quantity: true } } },
    }),
    // All-time scans per piece, for the "Most scanned" sort.
    prisma.qrCode.findMany({ where: { artistId: artist.id, artworkId: { not: null } }, select: { artworkId: true, _count: { select: { scans: true } } } }),
  ]);
  const scans = new Map<string, number>();
  for (const c of codes) if (c.artworkId) scans.set(c.artworkId, (scans.get(c.artworkId) ?? 0) + c._count.scans);
  const items = art
    .filter((a) => a.slug)
    .map(({ OrderItem, createdAt, ...a }) => ({
      ...a,
      slug: a.slug!,
      createdAt: createdAt.toISOString(),
      scans: scans.get(a.id) ?? 0,
      sold: OrderItem.reduce((n, o) => n + (o.quantity ?? 1), 0),
    }));
  const live = items.filter((a) => a.status === "APPROVED").length;
  const inReview = items.filter((a) => a.status === "PENDING").length;

  const more: MoreItem[] = items.length
    ? [
        ...(live ? [{ label: "Print all codes (PDF)", href: "/api/artworks/qr/bulk", icon: <FileDown />, external: true, hint: "A gallery label for every live piece" }] : []),
        { label: "Collections", href: "/studio/collections", icon: <Layers /> },
        { label: "Order prints in bulk", href: "/studio/bulk", icon: <Package /> },
      ]
    : [];

  return (
    <StudioPage
      title="My art"
      sub={items.length ? `${live} live${inReview ? ` · ${inReview} in review, usually live within a day` : ""}` : undefined}
      actions={
        // With nothing uploaded yet the empty state below carries the one Upload button.
        items.length > 0 && (
          <>
            <MoreMenu items={more} />
            <Link href="/studio/art/new" className="btn btn-blue"><Upload className="h-4 w-4" aria-hidden="true" />Upload art</Link>
          </>
        )
      }
    >
      <ArtGrid items={items} handle={artist.slug} />
    </StudioPage>
  );
}
