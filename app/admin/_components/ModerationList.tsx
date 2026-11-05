"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { failed, saved } from "@/lib/feedback";
import MoreMenu from "./MoreMenu";
import { passes, sortRows, SortSelect, TableToolbar, useTable, type SortDir } from "./table";
import { EmptyState } from "@/components/studio/EmptyState";
import { cn } from "@/lib/utils";
import { autoReasonOf, reasonText, THRESHOLDS } from "@/lib/moderation/policy";
import type { AutoCheckRecord, ScoreKey } from "@/lib/moderation/types";

export type ModArtwork = {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  sensitive: string[];
  flaggedReason: string | null;
  description: string;
  artistName: string;
  artistSlug: string;
  artistEmail: string;
  artistSince?: string;
  artistVerified?: boolean;
  /** Set when the image looks like another artist's piece (flaggedReason "possible_duplicate:<id>", lib/imageHash.ts). */
  duplicateOf?: DuplicateOf | { id: string; missing: true } | null;
  /** Latest automatic image check (lib/moderation), if one ran. */
  autoCheck?: AutoCheckRecord | null;
};

export type DuplicateOf = {
  id: string;
  title: string;
  slug: string | null;
  imageUrl: string;
  createdAt: string;
  status: ModArtwork["status"];
  artistName: string;
  artistSlug: string;
  artistEmail: string;
  artistSince: string;
  artistVerified: boolean;
  /** Bits that differ out of 64 (0 = same picture). */
  distance: number | null;
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/** Both images and both artists next to each other, so the reviewer can tell who made it. */
function Comparison({ a, d }: { a: ModArtwork; d: DuplicateOf }) {
  const side = (label: string, x: { title: string; imageUrl: string; createdAt: string; artistName: string; artistSlug: string; artistEmail: string; artistSince?: string; artistVerified?: boolean }, extra?: React.ReactNode) => (
    <figure className="grid min-w-0 content-start gap-1.5">
      <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-ink-2">{label}</span>
      <div className="aspect-[4/5] overflow-hidden rounded-[4px] bg-gallery">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={x.imageUrl} alt={x.title} loading="lazy" className="h-full w-full object-contain" />
      </div>
      <figcaption className="grid min-w-0 gap-0.5 text-[12.5px]">
        <b className="truncate text-[13.5px]">{x.title}</b>
        <span className="truncate">
          <Link href={`/@${x.artistSlug}`} className="font-semibold text-ink hover:text-scan">{x.artistName}</Link>
          {x.artistVerified && <span className="ml-1 rounded-full bg-scan-soft px-1.5 text-[11px] font-bold text-scan">Verified</span>}
        </span>
        <span className="truncate text-ink-2">{x.artistEmail}</span>
        <span className="text-ink-2">Uploaded {day(x.createdAt)}{x.artistSince ? ` · joined ${day(x.artistSince)}` : ""}</span>
        {extra}
      </figcaption>
    </figure>
  );
  return (
    <div className="grid gap-2 rounded-xl border-[1.5px] border-coral/50 bg-coral/5 p-3">
      <p className="text-[13px] font-semibold text-coral">
        Looks like another artist&apos;s piece{d.distance !== null ? ` (${d.distance === 0 ? "identical fingerprint" : `${d.distance} of 64 bits differ`})` : ""}. Approve if it&apos;s really theirs, reject if not.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {side("New upload", a)}
        {side("Already on Artfinity", d, <span className="text-ink-2">{STATUS[d.status].label}{d.slug ? <> · <a href={`/api/admin/originals/${d.id}`} className="font-semibold text-scan">Original</a></> : null}</span>)}
      </div>
    </div>
  );
}

const SCORE_ROWS: { key: ScoreKey; label: string; high: number }[] = [
  { key: "sexual", label: "Explicit", high: THRESHOLDS.review.sexual },
  { key: "nudity", label: "Nudity", high: THRESHOLDS.label.nudity },
  { key: "gore", label: "Gore", high: THRESHOLDS.review.gore },
  { key: "violence", label: "Violence", high: THRESHOLDS.label.violence },
  { key: "hate", label: "Hate symbol", high: THRESHOLDS.review.hate },
  { key: "isPhotoOfPerson", label: "Photo of person", high: THRESHOLDS.review.photoOfPerson },
  { key: "hasText", label: "Overlaid text", high: THRESHOLDS.review.memeText },
];

/** The automatic image check's verdict and scores (0-100), the ones past a threshold in coral. */
function AutoCheck({ c }: { c: AutoCheckRecord }) {
  const verdict =
    c.outcome === "review" ? `Held: ${c.reasons.map(reasonText).join(", ")}`
    : c.outcome === "labeled" ? `Added ${c.addedLabels.join(", ")}`
    : c.outcome === "error" ? `Didn't run (${c.error || "error"})`
    : "Clean";
  const rows = SCORE_ROWS.filter((r) => typeof c.scores[r.key] === "number");
  return (
    <details open={c.outcome === "review"} className="grid gap-1.5 rounded-lg border border-line bg-wall px-2.5 py-2 text-[12px]" aria-label="Automatic image check">
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-2">
        <b className={cn(c.outcome === "review" && "text-coral")}>Image check: {verdict}</b>
        <span className="text-ink-2">{c.provider}</span>
      </summary>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)_2.2em] items-center gap-x-2 gap-y-0.5">
          {rows.map((r) => {
            const v = c.scores[r.key]!;
            const hot = v >= r.high;
            return (
              <div key={r.key} className="contents">
                <dt className={cn("text-ink-2", hot && "font-semibold text-coral")}>{r.label}</dt>
                <dd className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span className={cn("block h-full rounded-full", hot ? "bg-coral" : "bg-ink-2/50")} style={{ width: `${Math.round(v * 100)}%` }} />
                </dd>
                <dd className={cn("num text-right", hot && "font-semibold text-coral")}>{Math.round(v * 100)}</dd>
              </div>
            );
          })}
        </dl>
      )}
      {c.addedLabels.length > 0 && (
        <p className="text-ink-2">
          Artist chose: {c.artistLabels.length ? c.artistLabels.join(", ") : "no labels"}. The check added {c.addedLabels.join(", ")}.
        </p>
      )}
    </details>
  );
}

/** Approve buttons. When the check added labels: "Approve + keep labels", or "Approve" back to the artist's own labels. */
function ApproveButtons({ a, busy, act }: { a: ModArtwork; busy: boolean; act: (a: ModArtwork, action: "approve" | "reject", labels?: "keep" | "artist") => void }) {
  if (!(a.status !== "APPROVED" || a.flaggedReason)) return null;
  const added = a.autoCheck?.addedLabels.filter((l) => a.sensitive.includes(l)) ?? [];
  if (!added.length) return <button type="button" disabled={busy} onClick={() => act(a, "approve")} className="btn btn-sm">Approve</button>;
  return (
    <>
      <button type="button" disabled={busy} onClick={() => act(a, "approve", "keep")} className="btn btn-sm">Approve + labels</button>
      <button type="button" disabled={busy} onClick={() => act(a, "approve", "artist")} className="btn btn-ghost btn-sm" title={`Approve and remove ${added.join(", ")} (added by the image check)`}>
        Approve
      </button>
    </>
  );
}

const STATUS: Record<ModArtwork["status"], { label: string; cls: string }> = {
  PENDING: { label: "Waiting", cls: "bg-sticker text-ink" },
  APPROVED: { label: "Live", cls: "bg-scan-soft text-scan" },
  REJECTED: { label: "Rejected", cls: "bg-coral/15 text-coral" },
};

const EMPTY: Record<string, string> = {
  queue: "Nothing to review",
  sensitive: "No sensitive labels",
  rejected: "Nothing rejected",
  live: "No live art yet",
};
const SORTS: { key: string; dir: SortDir; label: string }[] = [
  { key: "date", dir: "asc", label: "Oldest first" },
  { key: "date", dir: "desc", label: "Newest first" },
  { key: "artist", dir: "asc", label: "Artist A–Z" },
  { key: "title", dir: "asc", label: "Title A–Z" },
];

export default function ModerationList({ artworks: initial, tab }: { artworks: ModArtwork[]; tab: string }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const t = useTable(`moderation-${tab}`, { sort: { key: "date", dir: tab === "queue" ? "asc" : "desc" } });
  const shown = sortRows(
    items.filter((a) => passes(t.filters, { search: `${a.title} ${a.artistName} ${a.artistEmail} ${a.sensitive.join(" ")}`, date: a.createdAt })),
    t.sort,
    (a, k) => (k === "date" ? a.createdAt : k === "artist" ? a.artistName : a.title),
  );
  const picked = shown.filter((x) => selected.has(x.id));

  const bulk = async (action: "approve" | "reject") => {
    if (!picked.length) return;
    if (!confirm(`${action === "approve" ? "Approve" : "Reject"} ${picked.length} piece${picked.length === 1 ? "" : "s"}?${action === "reject" ? " They come off the artists' pages." : " They go live and the artists are emailed."}`)) return;
    setBusy("bulk");
    try {
      const r = await fetch("/api/admin/moderation/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: picked.map((x) => x.id), action }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "");
      const done = new Set<string>(d.done || []);
      const status = action === "approve" ? "APPROVED" : "REJECTED";
      setItems((prev) =>
        leavesTab(status)
          ? prev.filter((x) => !done.has(x.id))
          : prev.map((x) => (done.has(x.id) ? { ...x, status, flaggedReason: action === "approve" ? null : "rejected_by_admin" } : x))
      );
      setSelected(new Set());
      saved(`${done.size} ${action === "approve" ? "approved" : "rejected"}`);
      if (d.failed?.length) failed(`${d.failed.length} didn't go through`, { retry: () => bulk(action) });
      router.refresh();
    } catch (e: any) {
      failed(`Couldn't ${action}. ${e?.message || ""}`.trim(), { retry: () => bulk(action) });
    } finally {
      setBusy(null);
    }
  };

  const leavesTab = (status: ModArtwork["status"]) =>
    (tab === "queue") || (tab === "rejected" && status !== "REJECTED") || (tab === "live" && status !== "APPROVED");

  const act = async (a: ModArtwork, action: "approve" | "reject", labels?: "keep" | "artist") => {
    if (action === "reject" && !confirm(`Reject "${a.title}"? It comes off ${a.artistName}'s page.`)) return;
    setBusy(a.id);
    try {
      const r = await fetch(`/api/admin/moderation/artworks/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "reject" ? "rejected_by_admin" : undefined, labels }),
      });
      if (!r.ok) throw new Error(await r.text());
      const status = action === "approve" ? "APPROVED" : "REJECTED";
      setItems((prev) =>
        leavesTab(status)
          ? prev.filter((x) => x.id !== a.id)
          : prev.map((x) => (x.id === a.id ? { ...x, status, flaggedReason: action === "approve" ? null : "rejected_by_admin", sensitive: labels === "artist" && a.autoCheck ? a.autoCheck.artistLabels : x.sensitive } : x))
      );
      saved(action === "approve" ? `"${a.title}" is live${labels === "keep" ? ` with ${a.sensitive.join(", ")}` : labels === "artist" ? " without the added labels" : ""}` : `"${a.title}" rejected`);
      router.refresh();
    } catch (e: any) {
      failed(`Couldn't ${action}. ${e?.message || ""}`.trim(), { retry: () => act(a, action, labels) });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (a: ModArtwork) => {
    if (!confirm(`Delete "${a.title}" for good? Past orders keep their record.`)) return;
    setBusy(a.id);
    try {
      const r = await fetch(`/api/admin/moderation/artworks/${a.id}`, { method: "DELETE" });
      if (!r.ok && r.status !== 204) throw new Error(await r.text());
      setItems((prev) => prev.filter((x) => x.id !== a.id));
      saved("Deleted");
      router.refresh();
    } catch {
      failed("Couldn't delete.", { retry: () => remove(a) });
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return <EmptyState title={EMPTY[tab] ?? "Nothing here"} body={tab === "queue" ? "New uploads land here." : undefined} dab="var(--af-earned)" />;
  }

  const allPicked = shown.length > 0 && picked.length === shown.length;
  return (
    <div className="grid min-w-0 gap-3">
    <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search="Title, artist or label" dates count={shown.length} total={items.length}>
      <SortSelect options={SORTS} sort={t.sort} onChange={t.setSort} />
      <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-ink-2">
        <input type="checkbox" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(shown.map((x) => x.id)))} className="h-4 w-4 accent-[var(--af-ink)]" />
        Select all
      </label>
    </TableToolbar>
    <div className="contents">
      {picked.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="sticky top-[64px] z-10 flex flex-1 flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-ink bg-white px-3 py-2 shadow-sm">
          <b className="num text-[14px]">{picked.length} selected</b>
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("approve")} className="btn btn-blue btn-sm">Approve</button>
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("reject")} className="btn btn-ghost btn-sm">Reject</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[13px] font-semibold text-ink-2 underline">Clear</button>
        </div>
      )}
    </div>
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {shown.length === 0 && <li className="col-span-full"><EmptyState compact title="Nothing matches" action={{ label: "Clear filters", onClick: t.clear }} /></li>}
      {shown.map((a) => {
        const st = STATUS[a.status];
        const dup = a.duplicateOf && !("missing" in a.duplicateOf) ? a.duplicateOf : null;
        const flagged = a.duplicateOf
          ? (dup ? null : "possible duplicate of a piece that has since been deleted")
          : a.flaggedReason && a.flaggedReason !== "rejected_by_admin" ? (autoReasonOf(a.flaggedReason) ? (a.autoCheck ? null : `image check found ${reasonText(autoReasonOf(a.flaggedReason))}`) : a.flaggedReason) : null;
        if (dup) {
          return (
            <li key={a.id} className="grid content-start gap-3 rounded-2xl border border-line bg-white p-3 sm:col-span-2">
              <Comparison a={a} d={dup} />
              {a.autoCheck && <AutoCheck c={a.autoCheck} />}
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.title}`} className="h-4 w-4 accent-[var(--af-ink)]" />
                <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-bold", st.cls)}>{st.label}</span>
                <ApproveButtons a={a} busy={busy === a.id} act={act} />
                {a.status !== "REJECTED" && (
                  <button type="button" disabled={busy === a.id} onClick={() => act(a, "reject")} className="btn btn-ghost btn-sm">Reject</button>
                )}
                <MoreMenu label={<><span className="sr-only">More for {a.title}</span><span aria-hidden="true">More</span></>}>
                  <Link href={`/admin/artworks/${a.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                  <a href={`/api/admin/originals/${a.id}`} className="btn btn-ghost btn-sm">Download original</a>
                  <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="btn btn-ghost btn-sm text-coral">Delete</button>
                </MoreMenu>
              </div>
            </li>
          );
        }
        return (
          <li key={a.id} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-1">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[4px] bg-gallery">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.imageUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover" />
              <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11.5px] font-bold", st.cls)}>{st.label}</span>
              <label className="absolute right-1 top-1 grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-white/90">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.title}`} className="h-4 w-4 accent-[var(--af-ink)]" />
              </label>
            </div>
            <div className="grid min-w-0 content-start gap-2">
              <div className="min-w-0">
                <b className="block truncate text-[15.5px]">{a.title}</b>
                <div className="truncate text-[13px] text-ink-2">
                  <Link href={`/@${a.artistSlug}`} className="font-semibold text-ink hover:text-scan">{a.artistName}</Link>
                  {" · "}
                  {day(a.createdAt)}
                </div>
              </div>

              {a.sensitive.length > 0 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Sensitive labels">
                  {a.sensitive.map((l) => (
                    <span key={l} className="rounded-full border border-coral/40 bg-coral/10 px-2 py-0.5 text-[12px] font-semibold text-coral">{l}</span>
                  ))}
                </div>
              )}

              {flagged && <p className="text-[12.5px] font-semibold text-coral">Flagged: {flagged}</p>}
              {a.autoCheck && <AutoCheck c={a.autoCheck} />}

              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ApproveButtons a={a} busy={busy === a.id} act={act} />
                {a.status !== "REJECTED" && (
                  <button type="button" disabled={busy === a.id} onClick={() => act(a, "reject")} className="btn btn-ghost btn-sm">
                    {a.status === "APPROVED" ? "Take down" : "Reject"}
                  </button>
                )}
                <MoreMenu label={<><span className="sr-only">More for {a.title}</span><span aria-hidden="true">More</span></>}>
                  <Link href={`/admin/artworks/${a.id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
                  <a href={`/api/admin/originals/${a.id}`} className="btn btn-ghost btn-sm">Download original</a>
                  <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="btn btn-ghost btn-sm text-coral">Delete</button>
                </MoreMenu>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
