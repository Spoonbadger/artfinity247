"use client";

// Admin queue for buyer reprint requests (lib/reprints.ts). One card per request: order, prints, reason, photos, note,
// and the three outcomes. Every outcome emails the buyer.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { failed, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import { passes, sortRows, SortSelect, TableToolbar, useTable, type SortDir } from "./table";
import { cn } from "@/lib/utils";
import { reasonLabel, type ReprintStatus } from "@/lib/reprintFormat";
import { useAdminCan } from "./AdminRole";

export type AdminReprint = {
  id: string;
  status: ReprintStatus;
  reason: string;
  note: string;
  photos: string[];
  createdAt: string;
  decision: { note: string; at: string; reprintOrderId?: string } | null;
  order: {
    id: string; email: string; name: string; address: string | null; date: string; total: number; status: string; kind: string;
    shippedAt: string | null; deadline: string; month: string;
  };
  items: { id: string; qty: number; of: number; title: string; imageUrl: string | null; detail: string; artist: string }[];
};

const STATUS: Record<ReprintStatus, { label: string; cls: string }> = {
  open: { label: "Open", cls: "bg-coral/15 text-coral" },
  approved: { label: "Reprinting", cls: "bg-earned-soft text-earned" },
  refunded: { label: "Refunded", cls: "bg-sticker text-ink" },
  declined: { label: "Declined", cls: "bg-ink/10 text-ink-2" },
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });
const usd = (c: number) => "$" + (c / 100).toFixed(2);

function Card({ r }: { r: AdminReprint }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const canRefund = useAdminCan("money");

  const act = async (action: "approve" | "refund" | "decline") => {
    if (action === "decline" && !note.trim()) { setNoteOpen(true); failed("Add a short note for the buyer first.", { description: "Declining needs a reason." }); return; }
    if (action === "refund" && !confirm("Refund the buyer in Stripe yourself. This only marks it refunded and emails them. Go on?")) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/reprints/${r.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, note }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't save.");
      saved(action === "approve" ? "Reprint order created" : action === "refund" ? "Marked refunded" : "Declined", action === "approve" ? { next: { label: "See orders", href: "/admin/orders?month=all&filter=print" } } : undefined);
      router.refresh();
    } catch (e: any) {
      failed(e?.message || "Couldn't save.", { retry: () => act(action) });
      setBusy(null);
    }
  };

  const late = new Date(r.createdAt) > new Date(r.order.deadline);
  return (
    <li className="af-panel grid gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", STATUS[r.status].cls)}>{STATUS[r.status].label}</span>
            <b className="text-[17px]">{reasonLabel(r.reason)}</b>
            {late && <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[12px] font-bold text-coral">Past 14 days</span>}
          </div>
          <p className="mt-1 text-[14px] text-ink-2">
            <b className="text-ink">{r.order.name}</b> · <a href={`mailto:${r.order.email}`} className="underline-offset-2 hover:underline">{r.order.email}</a> · sent {day(r.createdAt)}
          </p>
        </div>
        <Link href={`/admin/orders/${r.order.id}`} className="num text-[13px] font-semibold text-scan hover:underline">
          Order {r.order.id.slice(-8).toUpperCase()} · {day(r.order.date)} · {r.order.kind === "reprint" ? "free reprint" : usd(r.order.total)}
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ul className="grid content-start gap-2">
          {r.items.map((i) => (
            <li key={i.id} className="flex items-center gap-3 rounded-xl border border-line bg-wall/50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {i.imageUrl ? <img src={i.imageUrl} alt="" className="h-[60px] w-[48px] shrink-0 rounded-[2px] object-cover shadow-[0_4px_10px_-6px_rgba(21,22,27,.5)]" /> : <span className="h-[60px] w-[48px] shrink-0 rounded-[2px] bg-gallery" />}
              <div className="min-w-0 text-[14px] leading-tight">
                <b className="block truncate">{i.title}{i.of > 1 ? <span className="num font-normal text-ink-2"> · {i.qty} of {i.of}</span> : null}</b>
                <span className="block truncate text-[13px] text-ink-2">{i.detail}</span>
                {i.artist && <span className="block truncate text-[13px] text-ink-2">by {i.artist}</span>}
              </div>
            </li>
          ))}
          <li className="text-[13px] text-ink-2">
            {r.order.status === "delivered" ? "Delivered" : r.order.status === "shipped" ? "Shipped" : r.order.status}
            {r.order.shippedAt ? `, shipped ${day(r.order.shippedAt)}` : ", no tracking on file"} · window ends {day(r.order.deadline)}
          </li>
        </ul>

        <div className="grid content-start gap-2">
          <div className="flex flex-wrap gap-2">
            {r.photos.map((p) => (
              <button key={p} type="button" onClick={() => setZoom(zoom === p ? null : p)} className="overflow-hidden rounded-[3px] border-[3px] border-white shadow-[0_6px_16px_-8px_rgba(21,22,27,.6)] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan" aria-label="Bigger photo" title="Show bigger">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="Buyer's photo" className="h-24 w-24 object-cover" />
              </button>
            ))}
          </div>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={zoom} target="_blank" rel="noreferrer"><img src={zoom} alt="Buyer's photo, large" className="max-h-[420px] w-auto max-w-full rounded-[3px] border-4 border-white shadow-[0_10px_24px_-12px_rgba(21,22,27,.6)]" /></a>
          )}
          {r.note ? <p className="whitespace-pre-line rounded-xl bg-wall px-3 py-2 text-[14.5px]">&ldquo;{r.note}&rdquo;</p> : <p className="text-[13px] text-ink-2">No note.</p>}
        </div>
      </div>

      {r.status === "open" ? (
        <div className="grid gap-2.5 border-t border-line pt-4">
          <details open={noteOpen || !!note} onToggle={(e) => setNoteOpen((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-[13.5px] font-semibold text-ink-2 hover:text-ink">Note to the buyer <span className="font-normal">(needed to decline)</span></summary>
            <label className="af-field mt-2">
              <span className="label">Note</span>
              <textarea rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} className="resize-none text-[15px]" />
            </label>
          </details>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => act("approve")} className="btn btn-sm" title="Makes a free order for the printer">{busy === "approve" ? "Creating…" : "Approve reprint"}</button>
            <button type="button" disabled={!!busy || !canRefund} title={canRefund ? undefined : "Refunds need the admin or owner role."} onClick={() => act("refund")} className="btn btn-ghost btn-sm">{busy === "refund" ? "Saving…" : "Refund instead"}</button>
            <button type="button" disabled={!!busy} onClick={() => act("decline")} className="btn btn-ghost btn-sm">{busy === "decline" ? "Saving…" : "Decline"}</button>
          </div>
        </div>
      ) : (
        r.decision && (
          <p className="border-t border-line pt-3 text-[13.5px] text-ink-2">
            {STATUS[r.status].label} {day(r.decision.at)}
            {r.decision.reprintOrderId ? <> · reprint order <span className="num">{r.decision.reprintOrderId.slice(-8)}</span></> : null}
            {r.status === "refunded" ? " · refund done in Stripe" : null}
            {r.decision.note ? <> · &ldquo;{r.decision.note}&rdquo;</> : null}
          </p>
        )
      )}
    </li>
  );
}

const SORTS: { key: string; dir: SortDir; label: string }[] = [
  { key: "date", dir: "asc", label: "Oldest first" },
  { key: "date", dir: "desc", label: "Newest first" },
  { key: "reason", dir: "asc", label: "Reason" },
  { key: "buyer", dir: "asc", label: "Buyer A–Z" },
];

export default function ReprintsQueue({ requests, tab = "open" }: { requests: AdminReprint[]; tab?: string }) {
  const t = useTable(`reprints-${tab}`, { sort: { key: "date", dir: tab === "open" ? "asc" : "desc" } });
  if (!requests.length) {
    return <EmptyState title={tab === "open" ? "No reprint requests" : "Nothing decided yet"} body={tab === "open" ? "Every print arrived happy." : undefined} dab="var(--af-earned)" />;
  }
  const reasons = Array.from(new Set(requests.map((r) => r.reason))).map((r) => ({ value: r, label: reasonLabel(r) }));
  const shown = sortRows(
    requests.filter((r) => passes(t.filters, { search: `${r.order.name} ${r.order.email} ${r.order.id} ${r.note} ${r.items.map((i) => `${i.title} ${i.artist}`).join(" ")}`, status: r.reason, date: r.createdAt })),
    t.sort,
    (r, k) => (k === "date" ? r.createdAt : k === "reason" ? reasonLabel(r.reason) : r.order.name.toLowerCase()),
  );
  return (
    <div className="grid min-w-0 gap-3">
      <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Buyer, order or print" statuses={reasons.length > 1 ? reasons : undefined} statusLabel="Reason" dates count={shown.length} total={requests.length}>
        <SortSelect options={SORTS} sort={t.sort} onChange={t.setSort} />
      </TableToolbar>
      {shown.length === 0 && <EmptyState compact title="Nothing matches" action={{ label: "Clear filters", onClick: t.clear }} />}
      <ul className="grid gap-4">{shown.map((r) => <Card key={r.id} r={r} />)}</ul>
    </div>
  );
}
