import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { adminOrRedirect } from "../_components/gate";
import { itemBreakdown, normalizeSize } from "@/lib/sales";
import { PaintChip } from "@/components/af/Brush";
import MonthPicker from "../_components/MonthPicker";
import OrdersBoard, { type AdminOrder } from "../_components/OrdersBoard";
import { currentMonth, monthLabel, monthRange, usd } from "../_components/util";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: { month?: string } }) {
  await adminOrRedirect("/admin/orders");
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

  const shaped: AdminOrder[] = orders.map((o) => {
    const items = o.items.map((it) => {
      // Authoritative money math (60/40 or 50/50 by order date) lives in lib/sales.ts.
      const b0 = itemBreakdown({ lineTotal: it.lineTotal, unitPrice: it.unitPrice, quantity: it.quantity, size: it.size, frameChosen: it.frameChosen, orderDate: o.createdAt });
      // Bulk = an artist buying their own prints at cost: no artist share.
      const b = o.kind === "bulk" ? { ...b0, companyShare: b0.companyShare + b0.artistShare, artistShare: 0 } : b0;
      const size = normalizeSize(it.size);
      return {
        id: it.id,
        slug: it.slug,
        title: it.title || it.artwork?.title || it.slug || "Untitled",
        artistName: it.artistName || it.artwork?.artist.artist_name || it.artwork?.artist.name || "",
        artistSlug: it.artwork?.artist.slug ?? null,
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
      kind: o.kind,
      items,
    };
  });

  const paid = shaped.filter((o) => o.paymentStatus === "paid");
  const gross = paid.reduce((n, o) => n + o.amountTotal, 0);
  const artistTotal = paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.artistShare, 0), 0);
  const companyTotal = paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.companyShare, 0), 0);
  const prints = paid.reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{month === "all" ? "All time" : monthLabel(month)}</p>
          <h1 className="display text-[44px] sm:text-[56px]">Orders</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <MonthPicker months={months} value={month} />
          {month !== "all" && (
            <a href={`/api/admin/payouts?month=${month}`} className="btn btn-ghost btn-sm mb-1">Export CSV</a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PaintChip color="#b8c4ff" value={paid.length} label="paid orders" note={`${prints} prints`} />
        <PaintChip color="#a8dcc4" value={usd(gross)} label="sales" earned />
        <PaintChip color="#f7c8a8" value={usd(artistTotal)} label="owed to artists" earned />
        <PaintChip color="var(--af-sticker)" value={usd(companyTotal)} label="Artfinity share" earned />
      </div>

      <OrdersBoard key={month} orders={shaped} />
    </div>
  );
}
