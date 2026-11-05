"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

const STATUS: Record<ModArtwork["status"], { label: string; cls: string }> = {
  PENDING: { label: "Waiting", cls: "bg-sticker text-ink" },
  APPROVED: { label: "Live", cls: "bg-scan-soft text-scan" },
  REJECTED: { label: "Rejected", cls: "bg-coral/15 text-coral" },
};

const EMPTY: Record<string, string> = {
  queue: "Nothing to review. New uploads land here.",
  sensitive: "No pieces carry sensitive labels.",
  rejected: "Nothing rejected.",
  live: "No live art yet.",
};

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
  const picked = items.filter((x) => selected.has(x.id));

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
      toast.success(`${done.size} ${action === "approve" ? "approved" : "rejected"}${d.failed?.length ? `, ${d.failed.length} failed` : ""}`);
      router.refresh();
    } catch (e: any) {
      toast.error(`Couldn't ${action}. ${e?.message || ""}`.trim());
    } finally {
      setBusy(null);
    }
  };

  const leavesTab = (status: ModArtwork["status"]) =>
    (tab === "queue") || (tab === "rejected" && status !== "REJECTED") || (tab === "live" && status !== "APPROVED");

  const act = async (a: ModArtwork, action: "approve" | "reject") => {
    if (action === "reject" && !confirm(`Reject "${a.title}"? It comes off ${a.artistName}'s page.`)) return;
    setBusy(a.id);
    try {
      const r = await fetch(`/api/admin/moderation/artworks/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "reject" ? "rejected_by_admin" : undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const status = action === "approve" ? "APPROVED" : "REJECTED";
      setItems((prev) =>
        leavesTab(status)
          ? prev.filter((x) => x.id !== a.id)
          : prev.map((x) => (x.id === a.id ? { ...x, status, flaggedReason: action === "approve" ? null : "rejected_by_admin" } : x))
      );
      toast.success(action === "approve" ? `"${a.title}" is live` : `"${a.title}" rejected`);
      router.refresh();
    } catch (e: any) {
      toast.error(`Couldn't ${action}. ${e?.message || ""}`.trim());
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
      toast.success("Deleted");
      router.refresh();
    } catch {
      toast.error("Couldn't delete.");
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-2xl border border-line bg-white px-4 py-16 text-center">
        <span className="paint-dab h-7 w-7" style={{ ["--dab" as string]: "var(--af-earned)" }} />
        <p className="text-[17px] font-semibold">{EMPTY[tab] ?? "Nothing here."}</p>
      </div>
    );
  }

  const allPicked = picked.length === items.length;
  return (
    <div className="grid gap-3">
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-ink-2">
        <input type="checkbox" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(items.map((x) => x.id)))} className="h-4 w-4 accent-[var(--af-ink)]" />
        Select all
      </label>
      {picked.length > 0 && (
        <div role="region" aria-label="Bulk actions" className="sticky top-[64px] z-10 flex flex-1 flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-ink bg-white px-3 py-2 shadow-sm">
          <b className="num text-[14px]">{picked.length} selected</b>
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("approve")} className="btn btn-blue btn-sm">Approve selected</button>
          <button type="button" disabled={busy === "bulk"} onClick={() => bulk("reject")} className="btn btn-ghost btn-sm">Reject selected</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-[13px] font-semibold text-ink-2 underline">Clear</button>
        </div>
      )}
    </div>
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((a) => {
        const st = STATUS[a.status];
        const dup = a.duplicateOf && !("missing" in a.duplicateOf) ? a.duplicateOf : null;
        const flagged = a.duplicateOf
          ? (dup ? null : "possible duplicate of a piece that has since been deleted")
          : a.flaggedReason && a.flaggedReason !== "rejected_by_admin" ? a.flaggedReason : null;
        if (dup) {
          return (
            <li key={a.id} className="grid content-start gap-3 rounded-2xl border border-line bg-white p-3 sm:col-span-2">
              <Comparison a={a} d={dup} />
              <div className="flex flex-wrap items-center gap-2">
                <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={`Select ${a.title}`} className="h-4 w-4 accent-[var(--af-ink)]" />
                <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-bold", st.cls)}>{st.label}</span>
                {(a.status !== "APPROVED" || a.flaggedReason) && (
                  <button type="button" disabled={busy === a.id} onClick={() => act(a, "approve")} className="btn btn-blue btn-sm">Approve</button>
                )}
                {a.status !== "REJECTED" && (
                  <button type="button" disabled={busy === a.id} onClick={() => act(a, "reject")} className="btn btn-ghost btn-sm">Reject</button>
                )}
                <Link href={`/admin/artworks/${a.id}/edit`} className="btn btn-ghost btn-sm" aria-label={`Edit ${a.title}`}>Edit</Link>
                <a href={`/api/admin/originals/${a.id}`} className="btn btn-ghost btn-sm" aria-label={`Download the original of ${a.title}`}>Original</a>
                <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="ml-auto text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-coral hover:underline">
                  Delete
                </button>
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
                  {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5" aria-label="Sensitive labels">
                {a.sensitive.length > 0 ? (
                  a.sensitive.map((l) => (
                    <span key={l} className="rounded-full border border-coral/40 bg-coral/10 px-2 py-0.5 text-[12px] font-semibold text-coral">{l}</span>
                  ))
                ) : (
                  <span className="text-[12px] text-ink-2">No sensitive labels</span>
                )}
              </div>

              {flagged && <p className="text-[12.5px] font-semibold text-coral">Flagged: {flagged}</p>}

              <div className="mt-1 flex flex-wrap items-center gap-2">
                {(a.status !== "APPROVED" || a.flaggedReason) && (
                  <button type="button" disabled={busy === a.id} onClick={() => act(a, "approve")} className="btn btn-blue btn-sm">Approve</button>
                )}
                {a.status !== "REJECTED" && (
                  <button type="button" disabled={busy === a.id} onClick={() => act(a, "reject")} className="btn btn-ghost btn-sm">
                    {a.status === "APPROVED" ? "Take down" : "Reject"}
                  </button>
                )}
                <Link href={`/admin/artworks/${a.id}/edit`} className="btn btn-ghost btn-sm" aria-label={`Edit ${a.title}`}>Edit</Link>
                <a href={`/api/admin/originals/${a.id}`} className="btn btn-ghost btn-sm" aria-label={`Download the original of ${a.title}`}>Original</a>
                <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="ml-auto text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-coral hover:underline">
                  Delete
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}
