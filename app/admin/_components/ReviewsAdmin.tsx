"use client";

import { useState } from "react";
import Link from "next/link";
import { artistPath, artPath } from "@/lib/urls";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import MoreMenu from "./MoreMenu";
import { passes, sortRows, SortSelect, TableToolbar, useTable, type SortDir } from "./table";
import { cn } from "@/lib/utils";
import { Dabs } from "@/components/reviews/ReviewStars";

export type AdminReview = {
  id: string;
  rating: number;
  body: string;
  buyerName: string;
  buyerCity: string | null;
  buyerEmail: string;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  artistReply: string | null;
  artworkTitle: string | null;
  artworkSlug: string | null;
  artistName: string;
  artistSlug: string;
  orderId: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  flagged: { label: "Held", cls: "bg-coral/15 text-coral" },
  published: { label: "Live", cls: "bg-earned-soft text-earned" },
  hidden: { label: "Hidden", cls: "bg-ink/10 text-ink-2" },
};

const SORTS: { key: string; dir: SortDir; label: string }[] = [
  { key: "held", dir: "asc", label: "Held first" },
  { key: "date", dir: "desc", label: "Newest first" },
  { key: "date", dir: "asc", label: "Oldest first" },
  { key: "rating", dir: "asc", label: "Lowest rating" },
  { key: "rating", dir: "desc", label: "Highest rating" },
];

export default function ReviewsAdmin({ reviews: initial, tab = "all" }: { reviews: AdminReview[]; tab?: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const t = useTable(`reviews-${tab}`, { sort: { key: "held", dir: "asc" } });
  const shown = sortRows(
    items.filter((r) => passes(t.filters, { search: `${r.buyerName} ${r.buyerEmail} ${r.body} ${r.artistName} ${r.artworkTitle ?? ""}`, status: r.status, date: r.createdAt })),
    t.sort,
    (r, k) => (k === "date" ? r.createdAt : k === "rating" ? r.rating : `${r.status === "flagged" ? 0 : 1}${r.createdAt}`),
  );

  const setStatus = async (r: AdminReview, status: "published" | "hidden") => {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "");
      setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      saved(status === "published" ? "Published" : "Hidden");
      router.refresh();
    } catch (e: any) {
      failed(`Couldn't update. ${e?.message || ""}`.trim(), { retry: () => setStatus(r, status) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (r: AdminReview) => {
    if (!confirm(`Deletes ${r.buyerName}'s review for good. They can write a new one from their link. This can't be undone.`)) return;
    setBusy(r.id);
    try {
      const res = await fetch(`/api/admin/reviews/${r.id}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error();
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      saved("Deleted");
      router.refresh();
    } catch {
      failed("Couldn't delete.", { retry: () => remove(r) });
    } finally {
      setBusy(null);
    }
  };

  if (!items.length) {
    return <EmptyState dab="var(--af-edge-strong)" title={tab === "hidden" ? "Nothing hidden" : "No reviews yet"} />;
  }

  return (
    <div className="grid min-w-0 gap-3">
    <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Buyer, words or artist" statuses={tab === "hidden" ? undefined : [{ value: "flagged", label: "Held" }, { value: "published", label: "Live" }, { value: "hidden", label: "Hidden" }]} dates count={shown.length} total={items.length}>
      <SortSelect options={SORTS} sort={t.sort} onChange={t.setSort} />
    </TableToolbar>
    {shown.length === 0 && <EmptyState dab="var(--af-edge-strong)" compact title="Nothing matches" action={{ label: "Clear filters", onClick: t.clear }} />}
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {shown.map((r) => {
        const st = STATUS[r.status] ?? STATUS.published;
        return (
          <li key={r.id} className={cn("grid content-start gap-2.5 rounded-2xl border bg-white p-4", r.status === "flagged" ? "border-coral" : "border-line")}>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[12px] font-bold", st.cls)}>{st.label}</span>
              <Dabs value={r.rating} size="sm" />
              <span className="ml-auto text-[13px] text-ink-2">{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}</span>
            </div>
            <p className="text-[13px] text-ink-2">
              <b className="text-ink">{r.buyerName}</b>{r.buyerCity ? ` · ${r.buyerCity}` : ""} · {r.buyerEmail}
              <br />
              on {r.artworkSlug ? <Link href={artPath(r.artistSlug, r.artworkSlug)} className="font-semibold text-ink hover:text-scan">{r.artworkTitle}</Link> : (r.artworkTitle || "a removed piece")}
              {" by "}
              <Link href={artistPath(r.artistSlug)} className="font-semibold text-ink hover:text-scan">{r.artistName}</Link>
            </p>
            {r.body ? <p className="whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">{r.body}</p> : <p className="text-[13px] italic text-ink-2">No words, just the rating.</p>}
            {r.photoUrl && (
              <a href={r.photoUrl} target="_blank" rel="noopener" className="block w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.photoUrl} alt="Buyer's photo" className="h-28 w-auto rounded-[3px] object-cover" />
              </a>
            )}
            {r.artistReply && <p className="rounded-lg bg-wall px-3 py-2 text-[13.5px]"><b>Reply:</b> {r.artistReply}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {r.status !== "published" && (
                <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, "published")} className="btn btn-sm">Publish</button>
              )}
              {r.status !== "hidden" && (
                <button type="button" disabled={busy === r.id} onClick={() => setStatus(r, "hidden")} className="btn btn-ghost btn-sm">Hide</button>
              )}
              <MoreMenu className="ml-auto" label={<><span className="sr-only">More for {r.buyerName}&apos;s review</span><span aria-hidden="true">More</span></>}>
                <Link href={`/admin/orders/${r.orderId}`} className="btn btn-ghost btn-sm">Open order</Link>
                <button type="button" disabled={busy === r.id} onClick={() => remove(r)} className="btn btn-ghost btn-sm text-coral">Delete</button>
              </MoreMenu>
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
