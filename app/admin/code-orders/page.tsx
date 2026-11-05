import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminRoleOrRedirect } from "../_components/gate";
import { usd } from "../_components/util";
import { orderItems, summaryOf } from "@/lib/codePrints";
import { ORDER_STATUSES, STATUS_DAB, STATUS_LABEL, codeOrderNumber, isOrderStatus } from "@/lib/printQueueFormat";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Code orders" };

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const FILTERS: { v: string; label: string }[] = [
  { v: "open", label: "To do" },
  { v: "paid", label: "To print" },
  { v: "printing", label: "Printing" },
  { v: "shipped", label: "Shipped" },
  { v: "delivered", label: "Delivered" },
  { v: "pending", label: "Not paid" },
  { v: "all", label: "All" },
];

/** Printed, laminated QR codes mailed to artists at cost (lib/codePrints.ts). */
export default async function CodeOrdersPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  await adminRoleOrRedirect("/admin/code-orders");
  const status = FILTERS.some((f) => f.v === searchParams.status) || ORDER_STATUSES.includes(searchParams.status as never) ? searchParams.status! : "open";
  const q = (searchParams.q || "").trim().slice(0, 80);
  const where: Prisma.CodePrintOrderWhereInput = {
    ...(status === "open" ? { status: { in: ["paid", "printing"] } } : status === "all" ? {} : { status }),
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { artistName: { contains: q, mode: "insensitive" } }, { shipName: { contains: q, mode: "insensitive" } }, { id: { endsWith: q.replace(/^CP-/i, "").toLowerCase() } }] } : {}),
  };
  const [orders, counts] = await Promise.all([
    prisma.codePrintOrder.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.codePrintOrder.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const n = (v: string) => (v === "open" ? count("paid") + count("printing") : v === "all" ? counts.reduce((t, c) => t + c._count._all, 0) : count(v));

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Orders</p>
        <h1 className="display text-[44px] sm:text-[56px]">Code orders</h1>
        <p className="mt-1 max-w-[64ch] text-[14.5px] text-ink-2">
          Artists&apos; QR codes we print, laminate, cut and mail, at cost. Download the print-ready PDF from each order, then mark it printing and shipped (the artist gets the tracking link).
          Prices are in <Link href="/admin/settings/code-prints" className="font-semibold text-scan">Code print prices</Link>.
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <Link key={f.v} href={`/admin/code-orders?status=${f.v}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={status === f.v ? "page" : undefined}
              className={cn("rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-semibold no-underline", status === f.v ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
              {f.label} <span className="num opacity-70">{n(f.v)}</span>
            </Link>
          ))}
        </nav>
        <input type="hidden" name="status" value={status} />
        <label className="ml-auto flex items-center gap-2">
          <span className="sr-only">Search code orders</span>
          <input name="q" defaultValue={q} placeholder="Artist, email or CP-number" className="min-h-[38px] w-60 rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[14px]" />
        </label>
        <button type="submit" className="btn btn-ghost btn-sm">Search</button>
      </form>

      <section className="af-card overflow-x-auto" aria-label="Code orders">
        {orders.length ? (
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <caption className="sr-only">Code print orders</caption>
            <thead className="border-b border-line text-[12px] text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Order</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Artist</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Cards</th>
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">Total</th>
                <th scope="col" className="px-3 py-2.5 font-semibold">Ship to</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const st = isOrderStatus(o.status) ? o.status : "pending";
                return (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-wall/60">
                    <td className="px-4 py-3">
                      <Link href={`/admin/code-orders/${o.id}`} className="num font-bold text-ink underline-offset-2 hover:underline">{codeOrderNumber(o.id)}</Link>
                      <span className="block text-[12.5px] text-ink-2">{day(o.paidAt ?? o.createdAt)}</span>
                    </td>
                    <td className="px-3 py-3">
                      {o.artistId ? <Link href={`/admin/artists/${o.artistId}`} className="font-semibold text-ink underline-offset-2 hover:underline">{o.artistName || o.email}</Link> : <span>{o.artistName || o.email}</span>}
                      <span className="block text-[12.5px] text-ink-2">{o.email}</span>
                    </td>
                    <td className="px-3 py-3">{summaryOf(orderItems(o.items))}</td>
                    <td className="num px-3 py-3 text-right font-bold">{usd(o.totalCents)}</td>
                    <td className="px-3 py-3 text-[13px]">{o.shipCity}, {o.shipState}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold">
                        <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: STATUS_DAB[st] }} aria-hidden="true" />{STATUS_LABEL[st]}
                      </span>
                      {o.refundNote && <span className="block text-[12px] text-coral">Refund noted</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="p-4 text-[14.5px] text-ink-2">
            {status === "open" ? "Nothing to print right now. New orders show here and raise an alert." : "No code orders match."}{" "}
            {status !== "all" && <Link href="/admin/code-orders?status=all" className="font-semibold text-scan">See all orders</Link>}
          </p>
        )}
      </section>
    </div>
  );
}
