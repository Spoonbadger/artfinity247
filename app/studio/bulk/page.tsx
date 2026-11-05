import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import HelpLink from "@/components/help/HelpLink";
import BulkOrder, { type BulkArt, type PastBulk } from "@/components/bulk/BulkOrder";
import { editionsFor } from "@/lib/editions";
import { editionLabel } from "@/lib/editionFormat";
import { BULK_SIZES, BULK_SIZE_KEY } from "@/lib/bulk";
import { sizeAllowed } from "@/lib/printSizes";
import { requireArtist, displayName } from "../_lib/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk prints" };

export default async function BulkPage({ searchParams }: { searchParams: { placed?: string; session_id?: string } }) {
  const artist = await requireArtist("/studio/bulk");

  const [rows, orders] = await Promise.all([
    prisma.artwork.findMany({
      where: { artistId: artist.id, status: { not: "REJECTED" }, slug: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, title: true, imageUrl: true, sensitive: true, editionSize: true, printableSizes: true },
    }),
    prisma.order.findMany({
      where: { kind: "bulk", bulkArtistId: artist.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, stripeSessionId: true, createdAt: true, amountTotal: true, paymentStatus: true, shippingStatus: true, shippingAddress: true,
        items: { select: { id: true, title: true, imageUrl: true, size: true, frameChosen: true, quantity: true, editionNumber: true, artwork: { select: { editionSize: true } } } },
      },
    }),
  ]);
  const editions = await editionsFor(rows);

  const arts: BulkArt[] = rows.map((r) => ({
    id: r.id, slug: r.slug!, title: r.title, imageUrl: r.imageUrl, sensitive: r.sensitive ?? [],
    edition: editions.get(r.id) ?? null,
    // Sizes the file is sharp enough for (empty = never checked, all allowed). Same rule as checkout.
    sizes: BULK_SIZES.filter((s) => sizeAllowed(r.printableSizes, BULK_SIZE_KEY[s])),
  }));
  const past: PastBulk[] = orders.map((o) => ({
    id: o.id,
    date: o.createdAt.toISOString(),
    total: o.amountTotal,
    paid: o.paymentStatus === "paid",
    status: o.shippingStatus,
    address: o.shippingAddress,
    test: o.stripeSessionId.startsWith("dev_"),
    items: o.items.map((i) => ({
      id: i.id, title: i.title || "Print", imageUrl: i.imageUrl, size: i.size, framed: i.frameChosen, quantity: i.quantity ?? 1,
      edition: editionLabel(i.editionNumber, i.quantity, i.artwork?.editionSize),
    })),
  }));

  const placedId = searchParams.placed || (searchParams.session_id ? orders.find((o) => o.stripeSessionId === searchParams.session_id)?.id : undefined);

  return (
    <StudioPage
      title="Bulk prints"
      sub="Your own prints, at cost. Sell them at markets and shows."
      actions={<><HelpLink href="/help/selling/bulk-prints" /><Link href="/studio/art" className="btn btn-ghost">My art</Link></>}
    >
      {arts.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-[4px] border-2 border-dashed border-line bg-wall px-6 py-16 text-center">
          <h2 className="display text-[34px]">Upload a piece first.</h2>
          <Link href="/studio/art/new" className="btn btn-blue">Upload art</Link>
        </div>
      ) : (
        <BulkOrder arts={arts} past={past} placedId={placedId ?? null} defaultName={displayName(artist)} />
      )}
    </StudioPage>
  );
}
