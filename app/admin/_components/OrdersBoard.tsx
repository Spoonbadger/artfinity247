"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SIZE_LABEL, usd } from "./util";

export type AdminOrderItem = {
  id: string;
  slug: string | null;
  title: string;
  artistName: string;
  artistSlug: string | null;
  imageUrl: string | null;
  sensitive: string[];
  size: string;
  frameChosen: boolean;
  frameColor: string | null;
  quantity: number;
  lineTotal: number;
  expenses: number;
  profit: number;
  artistShare: number;
  companyShare: number;
};

export type AdminOrder = {
  id: string;
  stripeSessionId: string;
  email: string;
  amountTotal: number;
  paymentStatus: string;
  createdAt: string;
  shippingName: string | null;
  shippingAddress: string | null;
  shippingStatus: string;
  sentToPrinter: boolean;
  /** "bulk" = an artist's own at-cost order (no artist share). */
  kind?: string;
  items: AdminOrderItem[];
};

type Filter = "all" | "print" | "ship" | "done";
const FILTERS: { id: Filter; label: string; test: (o: AdminOrder) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "print", label: "To print", test: (o) => !o.sentToPrinter && o.shippingStatus === "pending" },
  { id: "ship", label: "To ship", test: (o) => o.shippingStatus === "pending" },
  { id: "done", label: "Shipped", test: (o) => o.shippingStatus !== "pending" },
];

const SHIP_DAB: Record<string, string> = { pending: "var(--af-sticker)", shipped: "var(--af-scan)", delivered: "var(--af-earned)" };

/** Full-resolution original for the printer. Cloudinary: drop the f_auto,q_auto delivery transform, force a download. */
function downloadUrl(url: string) {
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes("/upload/f_auto,q_auto/")) return url.replace("/upload/f_auto,q_auto/", "/upload/fl_attachment/");
  return url.replace("/upload/", "/upload/fl_attachment/");
}

export default function OrdersBoard({ orders: initial }: { orders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, orders.filter(f.test).length])), [orders]);
  const shown = orders.filter(FILTERS.find((f) => f.id === filter)!.test);

  const patch = (id: string, p: Partial<AdminOrder>) => setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)));

  const toggleSent = async (o: AdminOrder) => {
    const next = !o.sentToPrinter;
    setBusy(o.id);
    patch(o.id, { sentToPrinter: next });
    try {
      const r = await fetch(`/api/orders/${o.id}/sent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sent: next }) });
      if (!r.ok) throw new Error();
      toast.success(next ? "Marked as sent to printer" : "Unmarked");
    } catch {
      patch(o.id, { sentToPrinter: !next });
      toast.error("Couldn't update. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const setShipping = async (o: AdminOrder, status: string) => {
    const prev = o.shippingStatus;
    setBusy(o.id);
    patch(o.id, { shippingStatus: status });
    try {
      const r = await fetch(`/api/orders/${o.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shippingStatus: status }) });
      if (!r.ok) throw new Error();
      toast.success(status === "pending" ? "Back to pending" : `Marked ${status}. Buyer emailed.`);
    } catch {
      patch(o.id, { shippingStatus: prev });
      toast.error("Couldn't update shipping. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="grid gap-4" aria-label="Orders">
      <div role="tablist" aria-label="Filter orders" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold transition",
              filter === f.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
            )}
          >
            {f.label} <span className="num ml-1 opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="hidden grid-cols-[120px_minmax(0,1.3fr)_minmax(0,1fr)_100px_150px_150px] gap-4 border-b border-line bg-wall/60 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2 lg:grid">
          <span>Prints</span><span>Buyer</span><span>Items</span><span className="text-right">Total</span><span>Printer</span><span>Shipping</span>
        </div>

        {shown.length === 0 && (
          <div className="grid justify-items-center gap-2 px-4 py-14 text-center">
            <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
            <p className="font-semibold">Nothing here.</p>
            <p className="text-[14px] text-ink-2">Try another month or filter.</p>
          </div>
        )}

        <ul className="divide-y divide-line">
          {shown.map((o) => {
            const date = new Date(o.createdAt);
            const artistShare = o.items.reduce((n, i) => n + i.artistShare, 0);
            return (
              <li key={o.id} className="px-4 py-4">
                <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-x-3 gap-y-2 lg:grid-cols-[120px_minmax(0,1.3fr)_minmax(0,1fr)_100px_150px_150px] lg:items-center lg:gap-4">
                  {/* thumbnails */}
                  <div className="row-span-4 flex flex-col gap-1.5 lg:row-span-1 lg:flex-row">
                    {o.items.slice(0, 3).map((i) => (
                      <div key={i.id} className="relative h-[60px] w-[48px] shrink-0 overflow-hidden rounded-[3px] bg-gallery shadow-[0_4px_10px_-6px_rgba(21,22,27,.5)]">
                        {i.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.imageUrl} alt={i.title} className={cn("h-full w-full object-cover", i.sensitive.length > 0 && "blur-[3px]")} loading="lazy" />
                        )}
                        {i.quantity > 1 && <span className="num absolute bottom-0.5 right-0.5 rounded-full bg-ink px-1.5 text-[10.5px] font-bold text-white">×{i.quantity}</span>}
                      </div>
                    ))}
                    {o.items.length > 3 && <span className="self-center text-[13px] font-semibold text-ink-2">+{o.items.length - 3}</span>}
                  </div>

                  {/* buyer */}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <b className="truncate text-[15px]">{o.shippingName || o.email}</b>
                      {o.paymentStatus !== "paid" && <span className="rounded-full bg-coral/15 px-2 text-[11.5px] font-bold text-coral">{o.paymentStatus}</span>}
                      {o.kind === "bulk" && <span className="rounded-full bg-sticker px-2 text-[11.5px] font-bold text-ink" title="Artist's own prints at cost. Not a sale, no payout.">Bulk</span>}
                    </div>
                    <div className="truncate text-[13px] text-ink-2">
                      {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {o.email}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(open === o.id ? null : o.id)}
                      aria-expanded={open === o.id}
                      aria-controls={`details-${o.id}`}
                      className="-my-2 inline-flex min-h-[40px] items-center text-[14px] font-semibold text-scan hover:underline md:my-0 md:min-h-0 md:text-[13px]"
                    >
                      {open === o.id ? "Hide details" : "Details"}
                    </button>
                  </div>

                  {/* items */}
                  <div className="min-w-0 text-[14px]">
                    {o.items.map((i) => (
                      <div key={i.id} className="truncate">
                        <span className="font-semibold">{i.title}</span>
                        <span className="text-ink-2"> · {SIZE_LABEL[i.size] ?? i.size}{i.frameChosen ? `, framed${i.frameColor ? ` ${i.frameColor}` : ""}` : ""}</span>
                      </div>
                    ))}
                  </div>

                  {/* total */}
                  <div className="flex items-baseline gap-2 lg:block lg:text-right">
                    <b className="num text-[16px] text-earned">{usd(o.amountTotal)}</b>
                    <div className="num text-[12.5px] text-ink-2">{usd(artistShare)} artist</div>
                  </div>

                  {/* printer + shipping (one row on phones, two columns on desktop) */}
                  <div className="flex flex-wrap gap-1.5 lg:contents">
                  <div>
                    <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1.5 text-[13px] sm:gap-2 sm:px-3 sm:text-[13.5px] font-semibold transition", o.sentToPrinter ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}>
                      <input type="checkbox" className="sr-only" checked={o.sentToPrinter} disabled={busy === o.id} onChange={() => toggleSent(o)} />
                      <span aria-hidden="true" className={cn("grid h-4 w-4 place-items-center rounded-[4px] border-[1.5px]", o.sentToPrinter ? "border-white bg-white text-ink" : "border-ink-2")}>
                        {o.sentToPrinter && <svg viewBox="0 0 16 16" className="h-3 w-3"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </span>
                      {o.sentToPrinter ? "At printer" : "Sent to printer"}
                    </label>
                  </div>

                  <div>
                    <label className="relative inline-flex items-center">
                      <span className="sr-only">Shipping status for {o.shippingName || o.email}</span>
                      <span className="paint-dab pointer-events-none absolute left-3" style={{ ["--dab" as string]: SHIP_DAB[o.shippingStatus] ?? "var(--af-line)" }} />
                      <select
                        value={o.shippingStatus || "pending"}
                        disabled={busy === o.id}
                        onChange={(e) => setShipping(o, e.target.value)}
                        className="cursor-pointer appearance-none rounded-full border-[1.5px] border-line bg-white min-h-[44px] py-1.5 pl-8 pr-7 text-[16px] sm:pl-9 sm:pr-8 md:min-h-0 md:text-[13.5px] font-semibold text-ink hover:border-ink focus:border-scan"
                      >
                        <option value="pending">Pending</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                      </select>
                      <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-3 h-3 w-3 text-ink-2" aria-hidden="true"><path d="M2.5 4.5l3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
                    </label>
                  </div>
                  </div>
                </div>

                {open === o.id && (
                  <div id={`details-${o.id}`} className="mt-3 grid gap-4 rounded-xl bg-wall/60 p-4 lg:ml-[136px] text-[13.5px] md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="grid content-start gap-1">
                      <span className="eyebrow">Ship to</span>
                      <span className="font-semibold">{o.shippingName || "No name"}</span>
                      <span className="text-ink-2">{o.shippingAddress || "No address"}</span>
                      <span className="mt-2 eyebrow">Stripe</span>
                      <span className="break-all text-ink-2">{o.stripeSessionId}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="num w-full min-w-[460px] text-left">
                        <thead className="text-[11.5px] uppercase tracking-[0.06em] text-ink-2">
                          <tr><th className="pb-1.5 font-bold">Print</th><th className="pb-1.5 text-right font-bold">Paid</th><th className="pb-1.5 text-right font-bold">Costs</th><th className="pb-1.5 text-right font-bold">Profit</th><th className="pb-1.5 text-right font-bold">Artist</th><th className="pb-1.5 text-right font-bold">Artfinity</th><th /></tr>
                        </thead>
                        <tbody>
                          {o.items.map((i) => (
                            <tr key={i.id} className="border-t border-line">
                              <td className="py-1.5 pr-2">
                                {i.slug ? <Link href={`/art/${i.slug}`} className="font-semibold text-ink hover:text-scan">{i.title}</Link> : <b>{i.title}</b>}
                                <div className="text-[12px] text-ink-2">{i.artistName}{i.quantity > 1 ? ` · ×${i.quantity}` : ""}</div>
                              </td>
                              <td className="py-1.5 text-right">{usd(i.lineTotal)}</td>
                              <td className="py-1.5 text-right text-ink-2">{usd(i.expenses)}</td>
                              <td className="py-1.5 text-right">{usd(i.profit)}</td>
                              <td className="py-1.5 text-right font-semibold text-earned">{usd(i.artistShare)}</td>
                              <td className="py-1.5 text-right">{usd(i.companyShare)}</td>
                              <td className="py-1.5 pl-3 text-right">
                                {i.imageUrl && <a href={downloadUrl(i.imageUrl)} target="_blank" rel="noreferrer" download className="whitespace-nowrap font-semibold text-scan">Full-res file</a>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
