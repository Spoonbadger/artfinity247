import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { StudioPage } from "@/components/studio/StudioPage";
import { EmptyState } from "@/components/studio/EmptyState";
import HelpLink from "@/components/help/HelpLink";
import BulkOrder, { type BulkArt, type PastBulk } from "@/components/bulk/BulkOrder";
import { editionsFor } from "@/lib/editions";
import { editionLabel } from "@/lib/editionFormat";
import { BULK_SIZES, BULK_SIZE_KEY, BULK_TIERS } from "@/lib/bulk";
import { sizeAllowed } from "@/lib/printSizes";
import { requireArtist, displayName } from "../_lib/data";
import { TAX_ENABLED } from "@/lib/tax";
import PaymentReturn from "@/components/payments/PaymentReturn";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bulk prints" };

export default async function BulkPage({ searchParams }: { searchParams: { placed?: string; session_id?: string; canceled?: string } }) {
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
  const placedOrder = placedId ? past.find((p) => p.id === placedId) : undefined;
  // Back from Stripe: paid but the webhook hasn't recorded it yet, or backed out without paying.
  const returned = searchParams.canceled ? "canceled" as const : searchParams.session_id && !placedId ? "confirming" as const : null;
  const firstTier = [...BULK_TIERS].sort((a, b) => a.min - b.min)[0];
  const tax = !process.env.STRIPE_SECRET_KEY ? "test" as const : TAX_ENABLED ? "added" as const : "none" as const;

  return (
    <StudioPage
      title="Bulk prints"
      sub="Your own prints at cost, to sell at markets and shows."
      actions={<HelpLink href="/help/selling/bulk-prints" />}
    >
      {arts.length === 0 ? (
        <EmptyState
          dab="#ff5a36"
          title="Upload art first"
          body={`Then order your own prints at cost to sell in person and keep what you charge.${firstTier ? ` ${firstTier.min} or more get ${firstTier.pct}% off.` : ""}`}
          action={{ label: "Upload art", href: "/studio/art/new" }}
          help={{ label: "How bulk prints work", href: "/help/selling/bulk-prints" }}
        />
      ) : (
        <>
          {placedOrder && <PaymentReturn kind="paid" message={placedOrder.test ? "Bulk order placed (test)" : "Bulk order placed"} description="We emailed your receipt." strip={["placed", "session_id"]} />}
          {returned === "canceled" && <PaymentReturn kind="canceled" message="Nothing was charged" strip={["canceled"]} />}
          <BulkOrder arts={arts} past={past} placedId={placedId ?? null} defaultName={displayName(artist)} tax={tax} returned={returned} />
        </>
      )}
    </StudioPage>
  );
}
