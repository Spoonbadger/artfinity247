"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { failed, saved } from "@/lib/feedback";
import { passes, sortRows, SortSelect, TableToolbar, useTable, type SortDir } from "./table";
import { cn } from "@/lib/utils";
import { artPath } from "@/lib/urls";
import { SIZE_LABEL, usd } from "./util";
import { CARRIERS, type Carrier, type Tracking } from "@/lib/tracking";
import type { PrinterState } from "@/lib/printer";

export type AdminOrderItem = {
  id: string;
  slug: string | null;
  title: string;
  artistName: string;
  artistSlug: string | null;
  artworkId: string | null;
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
  /** Signed certificate-of-authenticity page, for limited-edition lines. */
  certPath?: string | null;
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
  /** The automatic work order to the print lab (lib/printer.ts). */
  printer?: PrinterState;
  /** "bulk" = an artist's own at-cost order (no artist share). "reprint" = free replacement (lib/reprintFormat.ts). */
  kind?: string;
  items: AdminOrderItem[];
  /** Latest tracking sent to the buyer, if any. */
  tracking?: Tracking | null;
  /** The artist's thank-you note to print and put in the parcel ("Also print this note in the parcel"). */
  parcelNotes?: { id: string; artistName: string; subject: string; body: string; createdAt: string }[];
  /** Lines with a recorded refund (lib/refunds.ts). */
  refundedItems?: number;
};

export type Filter = "all" | "print" | "ship" | "done";
const FILTERS: { id: Filter; label: string; test: (o: AdminOrder) => boolean }[] = [
  { id: "all", label: "All", test: () => true },
  { id: "print", label: "To print", test: (o) => !o.sentToPrinter && o.shippingStatus === "pending" },
  { id: "ship", label: "To ship", test: (o) => o.shippingStatus === "pending" },
  { id: "done", label: "Shipped", test: (o) => o.shippingStatus !== "pending" },
];

const SHIP_DAB: Record<string, string> = { pending: "var(--af-sticker)", shipped: "var(--af-scan)", delivered: "var(--af-earned)" };

/** Full-resolution original for the printer (private, admin-only route). Without an artwork, the public file is all there is. */
function downloadUrl(item: AdminOrderItem) {
  const url = item.imageUrl || "";
  if (item.artworkId) return `/api/admin/originals/${item.artworkId}?src=${encodeURIComponent(url)}`;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes("/upload/f_auto,q_auto/")) return url.replace("/upload/f_auto,q_auto/", "/upload/fl_attachment/");
  return url.replace("/upload/", "/upload/fl_attachment/");
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
const SORTS: { key: string; dir: SortDir; label: string }[] = [
  { key: "date", dir: "desc", label: "Newest" },
  { key: "date", dir: "asc", label: "Oldest" },
  { key: "buyer", dir: "asc", label: "Buyer A–Z" },
  { key: "total", dir: "desc", label: "Total, high to low" },
  { key: "total", dir: "asc", label: "Total, low to high" },
];

export default function OrdersBoard({ orders: initial, printerAuto = false, initialFilter }: { orders: AdminOrder[]; printerAuto?: boolean; initialFilter?: Filter }) {
  const [orders, setOrders] = useState(initial);
  // No filter in the URL: start on "To print" when something is waiting, else everything.
  const [filter, setFilter] = useState<Filter>(initialFilter ?? (initial.some(FILTERS[1].test) ? "print" : "all"));
  const t = useTable("orders", { sort: { key: "date", dir: "desc" } });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  // The order being marked shipped: its tracking form is open.
  const [shipping, setShippingForm] = useState<string | null>(null);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.id, orders.filter(f.test).length])), [orders]);
  const inTab = orders.filter(FILTERS.find((f) => f.id === filter)!.test);
  const shown = sortRows(
    inTab.filter((o) => passes(t.filters, { search: `${o.shippingName ?? ""} ${o.email} ${o.id} ${o.items.map((i) => `${i.title} ${i.artistName}`).join(" ")}`, date: o.createdAt })),
    t.sort,
    (o, k) => (k === "date" ? o.createdAt : k === "buyer" ? (o.shippingName || o.email).toLowerCase() : o.amountTotal),
  );
  const sortHead = (k: string, label: string, firstDir: SortDir, right?: boolean) => {
    const on = t.sort?.key === k ? t.sort.dir : null;
    return (
      <button type="button" onClick={() => t.toggleSort(k, firstDir)} aria-label={`Sort by ${label}${on ? (on === "asc" ? ", ascending" : ", descending") : ""}`} className={cn("inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-ink", right && "justify-self-end", on && "text-ink")}>
        {label}<span aria-hidden="true">{on === "asc" ? "↑" : on === "desc" ? "↓" : "↕"}</span>
      </button>
    );
  };

  const patch = (id: string, p: Partial<AdminOrder>) => setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...p } : o)));
  const shownSelected = shown.filter((o) => selected.has(o.id));
  const allShownSelected = shown.length > 0 && shownSelected.length === shown.length;
  const toggleSelect = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllShown = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((o) => o.id)));

  // Bulk: mark the selected orders as sent to the printer.
  const bulkSent = async () => {
    const ids = shownSelected.filter((o) => !o.sentToPrinter).map((o) => o.id);
    if (!ids.length) return toast.message("Those are already marked as at the printer.");
    if (!confirm(`Mark ${ids.length} order${ids.length === 1 ? "" : "s"} as sent to the printer?`)) return;
    setBusy("bulk");
    try {
      const r = await fetch("/api/admin/orders/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action: "sent" }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "");
      const done = new Set<string>(d.updated || []);
      setOrders((prev) => prev.map((o) => (done.has(o.id) ? { ...o, sentToPrinter: true } : o)));
      saved(`${done.size} marked as sent to the printer`);
    } catch (e: any) {
      failed(e?.message || "Couldn't update.", { retry: bulkSent });
    } finally {
      setBusy(null);
    }
  };
  const exportHref = `/api/admin/orders/export?ids=${shownSelected.map((o) => o.id).join(",")}`;

  const toggleSent = async (o: AdminOrder) => {
    const next = !o.sentToPrinter;
    setBusy(o.id);
    patch(o.id, { sentToPrinter: next });
    try {
      const r = await fetch(`/api/orders/${o.id}/sent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sent: next }) });
      if (!r.ok) throw new Error();
      saved(next ? "Marked as sent to printer" : "Unmarked");
    } catch {
      patch(o.id, { sentToPrinter: !next });
      failed("Couldn't update the printer status.", { retry: () => toggleSent({ ...o, sentToPrinter: !next }) });
    } finally {
      setBusy(null);
    }
  };

  // "Resend work order" / "Retry": send the lab the work order again (lib/printer.ts).
  const resend = async (o: AdminOrder) => {
    setBusy(o.id);
    patch(o.id, { printer: { status: "sending", at: o.printer?.at ?? null, error: null } });
    let fresh = false;
    try {
      const r = await fetch(`/api/admin/orders/${o.id}/work-order`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (d.printer) { fresh = true; patch(o.id, { printer: d.printer, sentToPrinter: !!d.sentToPrinter }); }
      if (!r.ok) throw new Error(d.error || "");
      saved("Work order sent to the printer");
    } catch (e: any) {
      if (!fresh) patch(o.id, { printer: o.printer });
      failed(e?.message || "Couldn't send the work order.", { fix: { label: "Check print lab setup", href: "/admin#integrations" } });
    } finally {
      setBusy(null);
    }
  };

  const setShipping = async (o: AdminOrder, status: string, tracking?: { carrier: Carrier; trackingNumber: string; trackingUrl?: string }) => {
    // Shipped needs a tracking number first.
    if (status === "shipped" && o.shippingStatus !== "shipped" && !tracking) {
      setShippingForm(o.id);
      return;
    }
    const prev = o.shippingStatus;
    setBusy(o.id);
    patch(o.id, { shippingStatus: status });
    try {
      const r = await fetch(`/api/orders/${o.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shippingStatus: status, ...tracking }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "");
      if (d.tracking) patch(o.id, { tracking: d.tracking });
      setShippingForm(null);
      const emailed = (prev === "pending" && status === "shipped") || (prev === "shipped" && status === "delivered");
      saved(status === "pending" ? "Back to pending" : `Marked ${status}`, emailed ? { description: "Buyer emailed." } : undefined);
    } catch (e: any) {
      patch(o.id, { shippingStatus: prev });
      failed(e?.message || "Couldn't update shipping.", { retry: () => setShipping(o, status, tracking) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="grid gap-4" aria-label="Orders">
      <div role="tablist" aria-label="Filter orders" className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "min-h-[40px] rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold transition",
              filter === f.id ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
            )}
          >
            {f.label} <span className="num ml-1 opacity-70">{counts[f.id]}</span>
          </button>
        ))}
      </div>
      <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Buyer, email or print" dates count={shown.length} total={inTab.length}>
        <SortSelect options={SORTS} sort={t.sort} onChange={t.setSort} className="lg:hidden" />
        <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-ink-2">
          <input type="checkbox" checked={allShownSelected} onChange={selectAllShown} className="h-4 w-4 accent-[var(--af-ink)]" />
          Select all
        </label>
      </TableToolbar>

      {shownSelected.length > 0 && (
        <div className="sticky top-[64px] z-10 flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-ink bg-white px-3 py-2 shadow-sm" role="region" aria-label="Bulk actions">
          <b className="num text-[14px]">{shownSelected.length} selected</b>
          <button type="button" disabled={busy === "bulk"} onClick={bulkSent} className="btn btn-blue btn-sm">Mark sent to printer</button>
          <a href={exportHref} className="btn btn-ghost btn-sm" download>Export CSV for the lab</a>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[13px] font-semibold text-ink-2 underline">Clear</button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="hidden grid-cols-[120px_minmax(0,1.3fr)_minmax(0,1fr)_100px_150px_150px] gap-4 border-b border-line bg-wall/60 px-4 py-2.5 text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2 lg:grid">
          <span>Prints</span>{sortHead("date", "Date", "desc")}<span>Items</span>{sortHead("total", "Total", "desc", true)}<span>Printer</span><span>Shipping</span>
        </div>

        {shown.length === 0 && (
          <div className="grid justify-items-center gap-2 px-4 py-14 text-center">
            <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
            <p className="font-semibold">{filter === "print" && !t.active ? "Nothing to print" : "Nothing here"}</p>
            <p className="text-[14px] text-ink-2">{t.active ? <button type="button" onClick={t.clear} className="font-semibold text-scan underline">Clear filters</button> : "Try another month or filter."}</p>
          </div>
        )}

        <ul className="divide-y divide-line">
          {shown.map((o) => {
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
                      <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} aria-label={`Select order from ${o.shippingName || o.email}`} className="h-4 w-4 self-center accent-[var(--af-ink)]" />
                      <Link href={`/admin/orders/${o.id}`} className="truncate text-[15px] font-bold text-ink hover:text-scan">{o.shippingName || o.email}</Link>
                      {!!o.refundedItems && <span className="rounded-full bg-coral/15 px-2 text-[11.5px] font-bold text-coral">{o.refundedItems === o.items.length ? "Refunded" : "Part refunded"}</span>}
                      {o.kind === "reprint" ? (
                        <span className="rounded-full bg-[#f3dcc8] px-2 text-[11.5px] font-bold text-ink" title="Free reprint for a damaged or wrong print. Artfinity pays. Not a sale, no payout.">Free reprint</span>
                      ) : o.paymentStatus !== "paid" && <span className="rounded-full bg-coral/15 px-2 text-[11.5px] font-bold text-coral">{o.paymentStatus}</span>}
                      {o.kind === "bulk" && <span className="rounded-full bg-sticker px-2 text-[11.5px] font-bold text-ink" title="Artist's own prints at cost. Not a sale, no payout.">Bulk</span>}
                      {!!o.parcelNotes?.length && (
                        <a href={`/admin/orders/${o.id}/slip`} target="_blank" rel="noopener" className="rounded-full bg-[#e6dcff] px-2 text-[11.5px] font-bold text-ink no-underline hover:underline" title="The artist wrote a note to print and put in the parcel">Parcel note</a>
                      )}
                    </div>
                    <div className="truncate text-[13px] text-ink-2">
                      <span className="num">{when(o.createdAt)}</span> · {o.email}
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
                        {i.certPath && (
                          <> · <a href={i.certPath} target="_blank" rel="noopener" className="font-semibold text-scan hover:underline">Certificate</a></>
                        )}
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
                    <PrinterLine o={o} busy={busy === o.id} onRetry={() => resend(o)} />
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

                {shipping === o.id && (
                  <ShipForm busy={busy === o.id} onCancel={() => setShippingForm(null)} onSubmit={(t) => setShipping(o, "shipped", t)} />
                )}
                {o.tracking && o.shippingStatus !== "pending" && shipping !== o.id && (
                  <p className="mt-2 text-[13px] text-ink-2 lg:ml-[136px]">
                    {o.tracking.carrier} <span className="num font-semibold text-ink">{o.tracking.number}</span>
                    {o.tracking.url && <> · <a href={o.tracking.url} target="_blank" rel="noreferrer" className="font-semibold text-scan">Track</a></>}
                  </p>
                )}

                {open === o.id && (
                  <div id={`details-${o.id}`} className="mt-3 grid gap-4 rounded-xl bg-wall/60 p-4 lg:ml-[136px] text-[13.5px] md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="grid content-start gap-1">
                      <span className="eyebrow">Ship to</span>
                      <span className="font-semibold">{o.shippingName || "No name"}</span>
                      <span className="text-ink-2">{o.shippingAddress || "No address"}</span>
                      <span className="mt-2 eyebrow">Stripe</span>
                      <span className="break-all text-ink-2">{o.stripeSessionId}</span>
                      <a href={`/admin/orders/${o.id}/slip`} target="_blank" rel="noopener" className="mt-2 font-semibold text-scan">Packing slip</a>
                      {printerAuto && (o.paymentStatus === "paid" || o.kind === "reprint") && (
                        <button type="button" disabled={busy === o.id} onClick={() => resend(o)} className="btn btn-ghost btn-sm mt-2 justify-self-start">
                          {o.printer?.status === "sent" ? "Resend work order" : "Send work order"}
                        </button>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="num w-full min-w-[460px] text-left">
                        <thead className="text-[11.5px] uppercase tracking-[0.06em] text-ink-2">
                          <tr><th className="pb-1.5 font-bold">Print</th><th className="pb-1.5 text-right font-bold">Paid</th><th className="pb-1.5 text-right font-bold">Costs</th><th className="pb-1.5 text-right font-bold">Profit</th><th className="pb-1.5 text-right font-bold">Artist</th><th className="pb-1.5 text-right font-bold">Artfinity</th><th><span className="sr-only">Actions</span></th></tr>
                        </thead>
                        <tbody>
                          {o.items.map((i) => (
                            <tr key={i.id} className="border-t border-line">
                              <td className="py-1.5 pr-2">
                                {i.slug ? <Link href={i.artistSlug ? artPath(i.artistSlug, i.slug) : `/art/${encodeURIComponent(i.slug)}`} className="font-semibold text-ink hover:text-scan">{i.title}</Link> : <b>{i.title}</b>}
                                <div className="text-[12px] text-ink-2">{i.artistName}{i.quantity > 1 ? ` · ×${i.quantity}` : ""}</div>
                              </td>
                              <td className="py-1.5 text-right">{usd(i.lineTotal)}</td>
                              <td className="py-1.5 text-right text-ink-2">{usd(i.expenses)}</td>
                              <td className="py-1.5 text-right">{usd(i.profit)}</td>
                              <td className="py-1.5 text-right font-semibold text-earned">{usd(i.artistShare)}</td>
                              <td className="py-1.5 text-right">{usd(i.companyShare)}</td>
                              <td className="py-1.5 pl-3 text-right">
                                {i.imageUrl && <a href={downloadUrl(i)} target="_blank" rel="noreferrer" download className="whitespace-nowrap font-semibold text-scan">Full-res file</a>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!!o.parcelNotes?.length && (
                      <div className="grid gap-2 md:col-span-2">
                        <span className="eyebrow">Print this note in the parcel</span>
                        {o.parcelNotes.map((n) => (
                          <figure key={n.id} className="grid gap-1.5 rounded-lg border-[1.5px] border-dashed border-ink/30 bg-white p-3">
                            <blockquote className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{n.body}</blockquote>
                            <figcaption className="text-[12.5px] text-ink-2">— {n.artistName}</figcaption>
                          </figure>
                        ))}
                        <a href={`/admin/orders/${o.id}/slip`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm justify-self-start">Print slip with note</a>
                      </div>
                    )}
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

/** Under the printer toggle: when the work order went out automatically, or a Retry when it didn't. */
function PrinterLine({ o, busy, onRetry }: { o: AdminOrder; busy: boolean; onRetry: () => void }) {
  const p = o.printer;
  if (!p || p.status === "none") return null;
  if (p.status === "sending") return <p className="mt-1 text-[12px] text-ink-2">Sending to printer…</p>;
  if (p.status === "failed") {
    return (
      <button type="button" disabled={busy} onClick={onRetry} title={p.error || undefined} className="mt-1 block text-left text-[12px] font-semibold text-coral hover:underline">
        Couldn&apos;t send to printer — Retry
      </button>
    );
  }
  return <p className="mt-1 text-[12px] leading-snug text-ink-2" title={p.at ? `Sent automatically ${when(p.at)}` : undefined}>Auto-sent{p.at ? ` ${new Date(p.at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` : ""}</p>;
}

function ShipForm({ busy, onSubmit, onCancel }: { busy: boolean; onSubmit: (t: { carrier: Carrier; trackingNumber: string; trackingUrl?: string }) => void; onCancel: () => void }) {
  const [carrier, setCarrier] = useState<Carrier>("USPS");
  const [num, setNum] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (num.trim().length < 4) return setErr("Add the tracking number.");
    if (carrier === "Other" && !/^https:\/\//.test(url.trim())) return setErr("Paste the https tracking link.");
    setErr(null);
    onSubmit({ carrier, trackingNumber: num.trim(), ...(carrier === "Other" ? { trackingUrl: url.trim() } : {}) });
  };
  return (
    <form onSubmit={submit} className="mt-3 grid gap-3 rounded-xl border-[1.5px] border-ink bg-white p-3 lg:ml-[136px] sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end" noValidate>
      <label className="grid gap-1 text-[12.5px] font-semibold">
        Carrier
        <select value={carrier} onChange={(e) => setCarrier(e.target.value as Carrier)} className="min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] text-ink">
          {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <div className="grid gap-2">
        <label className="grid gap-1 text-[12.5px] font-semibold">
          Tracking number
          <input value={num} onChange={(e) => setNum(e.target.value)} maxLength={40} autoFocus className="min-h-[40px] rounded-lg border-[1.5px] border-line px-2.5 text-[14px] text-ink" placeholder="9400 1000 0000 0000 0000 00" />
        </label>
        {carrier === "Other" && (
          <label className="grid gap-1 text-[12.5px] font-semibold">
            Tracking link
            <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={300} type="url" className="min-h-[40px] rounded-lg border-[1.5px] border-line px-2.5 text-[14px] text-ink" placeholder="https://" />
          </label>
        )}
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-blue btn-sm">Mark shipped</button>
        <button type="button" onClick={onCancel} className="btn btn-ghost btn-sm">Cancel</button>
      </div>
      {err && <p role="alert" className="text-[13px] font-semibold text-coral sm:col-span-3">{err}</p>}
      <p className="text-[12.5px] text-ink-2 sm:col-span-3">The buyer gets an email with this link.</p>
    </form>
  );
}
