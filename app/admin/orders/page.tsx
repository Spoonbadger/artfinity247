import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../_components/gate";
import { roleCan } from "@/lib/adminCaps";
import { itemBreakdown, normalizeSize } from "@/lib/sales";
import MonthPicker from "../_components/MonthPicker";
import { PageHead } from "../_components/ui";
import OrdersBoard, { type AdminOrder, type Filter } from "../_components/OrdersBoard";
import { activeRefunds } from "@/lib/refunds";
import { currentMonth, monthLabel, monthRange, usd } from "../_components/util";
import { trackingForOrders } from "@/lib/shipping/store";
import { PARCEL_TAG, splitParcelTag } from "@/lib/artistEmails";
import { certPath } from "@/lib/certificates";
import { printerAuto, printerState } from "@/lib/printer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

const FILTERS: Record<string, Filter> = { print: "print", ship: "ship", shipped: "done", done: "done" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: { month?: string; filter?: string } }) {
  const admin = await adminRoleOrRedirect("/admin/orders");
  const monthRows = await prisma.$queryRaw<{ m: string }[]>`
    SELECT DISTINCT to_char("createdAt" AT TIME ZONE 'UTC', 'YYYY-MM') AS m FROM "Order" ORDER BY m DESC`;
  const months = Array.from(new Set([currentMonth(), ...monthRows.map((r) => r.m)])).sort().reverse();
  const month = searchParams.month === "all" || (searchParams.month && monthRange(searchParams.month))
    ? searchParams.month!
    : monthRows[0]?.m ?? currentMonth();
  const range = month === "all" ? null : monthRange(month);

  const orders = await prisma.order.findMany({
    where: range ? { createdAt: { gte: range.start, lt: range.end } } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { artwork: { select: { title: true, sensitive: true, artist: { select: { artist_name: true, name: true, slug: true } } } } },
      },
    },
  });

  // Tracking: the order's columns, else the older Message on the order (lib/shipping/store.ts).
  const trackingByOrder = await trackingForOrders(orders);

  // Artists' thank-you notes to print into the parcel: Messages tagged [parcel] on the order (Studio customer page).
  const parcelRows = orders.length
    ? await prisma.message.findMany({
        where: { orderId: { in: orders.map((o) => o.id) }, direction: "out", subject: { startsWith: PARCEL_TAG } },
        orderBy: { createdAt: "asc" },
        select: { id: true, orderId: true, subject: true, body: true, createdAt: true, artist: { select: { artist_name: true, name: true } } },
      })
    : [];
  const parcelByOrder = new Map<string, NonNullable<AdminOrder["parcelNotes"]>>();
  for (const m of parcelRows) {
    if (!m.orderId) continue;
    const list = parcelByOrder.get(m.orderId) ?? [];
    list.push({ id: m.id, artistName: m.artist.artist_name || m.artist.name, subject: splitParcelTag(m.subject).subject, body: m.body, createdAt: m.createdAt.toISOString() });
    parcelByOrder.set(m.orderId, list);
  }

  const refunds = await activeRefunds(orders.map((o) => o.id));

  const shaped: AdminOrder[] = orders.map((o) => {
    const items = o.items.map((it) => {
      // Authoritative money math (60/40 or 50/50 by order date) lives in lib/sales.ts.
      const b0 = itemBreakdown({ lineTotal: it.lineTotal, unitPrice: it.unitPrice, quantity: it.quantity, size: it.size, frameChosen: it.frameChosen, orderDate: o.createdAt, artistSplit: it.artistSplit });
      // Bulk = an artist buying their own prints at cost: no artist share.
      const b1 = o.kind === "bulk" ? { ...b0, companyShare: b0.companyShare + b0.artistShare, artistShare: 0 } : b0;
      // A refund that reversed the artist's share leaves them nothing on the line.
      const b = refunds.get(it.id)?.reversed ? { ...b1, artistShare: 0 } : b1;
      const size = normalizeSize(it.size);
      return {
        id: it.id,
        slug: it.slug,
        title: it.title || it.artwork?.title || it.slug || "Untitled",
        artistName: it.artistName || it.artwork?.artist.artist_name || it.artwork?.artist.name || "",
        artistSlug: it.artwork?.artist.slug ?? null,
        artworkId: it.artworkId,
        imageUrl: it.imageUrl,
        sensitive: it.artwork?.sensitive ?? [],
        size,
        frameChosen: it.frameChosen,
        frameColor: it.frameColor,
        quantity: b.quantity,
        lineTotal: b.lineTotal,
        expenses: b.expenses,
        profit: b.profit,
        artistShare: b.artistShare,
        companyShare: b.companyShare,
        // Limited editions: print the certificate of authenticity into the parcel (lib/certificates.ts).
        certPath: o.paymentStatus === "paid" && it.editionNumber && it.artworkId ? certPath(it.id) : null,
      };
    });
    return {
      id: o.id,
      stripeSessionId: o.stripeSessionId,
      email: o.email,
      amountTotal: o.amountTotal,
      paymentStatus: o.paymentStatus,
      createdAt: o.createdAt.toISOString(),
      shippingName: o.shippingName,
      shippingAddress: o.shippingAddress,
      shippingStatus: o.shippingStatus,
      sentToPrinter: o.sentToPrinter,
      printer: printerState(o),
      kind: o.kind,
      items,
      tracking: trackingByOrder.get(o.id) ?? null,
      parcelNotes: parcelByOrder.get(o.id) ?? [],
      refundedItems: o.items.filter((it) => refunds.has(it.id)).length,
    };
  });

  const paid = shaped.filter((o) => o.paymentStatus === "paid");
  const gross = paid.reduce((n, o) => n + o.amountTotal, 0);
  const artistTotal = paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.artistShare, 0), 0);
  const companyTotal = paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.companyShare, 0), 0);
  const prints = paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);

  const toPrint = shaped.filter((o) => !o.sentToPrinter && o.shippingStatus === "pending").length;
  const toShip = shaped.filter((o) => o.shippingStatus === "pending").length;

  return (
    <div className="grid gap-5">
      <PageHead
        title="Orders"
        sub={toPrint || toShip ? `${toPrint} to print · ${toShip} to ship` : "Everything's shipped"}
        action={
          <>
            <MonthPicker months={months} value={month} />
            {month !== "all" && roleCan(admin.adminRole, "money") && <a href={`/api/admin/payouts?month=${month}`} className="btn btn-ghost btn-sm">Export CSV</a>}
          </>
        }
      />

      <dl className="num flex flex-wrap gap-x-6 gap-y-1 text-[14px]">
        <div className="flex gap-1.5"><dt className="text-ink-2">{month === "all" ? "All time" : monthLabel(month)}:</dt><dd className="font-semibold">{paid.length} paid · {prints} prints</dd></div>
        <div className="flex gap-1.5"><dt className="text-ink-2">Sales</dt><dd className="font-semibold">{usd(gross)}</dd></div>
        <div className="flex gap-1.5"><dt className="text-ink-2">Owed to artists</dt><dd className="font-semibold">{usd(artistTotal)}</dd></div>
        <div className="flex gap-1.5"><dt className="text-ink-2">Artfinity</dt><dd className="font-semibold text-earned">{usd(companyTotal)}</dd></div>
      </dl>

      <OrdersBoard key={month} orders={shaped} printerAuto={printerAuto()} initialFilter={FILTERS[searchParams.filter || ""]} />
    </div>
  );
}
