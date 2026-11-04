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
    select: { id: true, slug: true, title: true, imageUrl: true, status: true, sensitive: true, flaggedReason: true, OrderItem: { where: { order: { paymentStatus: "paid" } }, select: { quantity: true } } },
  });
  const items = art
    .filter((a) => a.slug)
    .map(({ OrderItem, ...a }) => ({ ...a, slug: a.slug!, sold: OrderItem.reduce((n, o) => n + (o.quantity ?? 1), 0) }));
  const live = items.filter((a) => a.status !== "REJECTED").length;

  return (
    <StudioPage
      title="My art"
      sub={`${live} on your page`}
      actions={<Link href="/studio/art/new" className="btn btn-blue">Upload art</Link>}
    >
      <ArtGrid items={items} />
    </StudioPage>
  );
}
