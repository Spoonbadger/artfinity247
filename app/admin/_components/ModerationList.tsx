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
};

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

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((a) => {
        const st = STATUS[a.status];
        const flagged = a.flaggedReason && a.flaggedReason !== "rejected_by_admin" ? a.flaggedReason : null;
        return (
          <li key={a.id} className="grid grid-cols-[104px_minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-white p-3 sm:grid-cols-1">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[4px] bg-gallery">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.imageUrl} alt={a.title} loading="lazy" className="h-full w-full object-cover" />
              <span className={cn("absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11.5px] font-bold", st.cls)}>{st.label}</span>
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
                <button type="button" disabled={busy === a.id} onClick={() => remove(a)} className="ml-auto text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-coral hover:underline">
                  Delete
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
