"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { EmptyState } from "./EmptyState";
import { cn } from "@/lib/utils";
import { artPath } from "@/lib/urls";

export type GridArt = {
  id: string;
  slug: string;
  title: string;
  imageUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  sensitive: string[];
  flaggedReason: string | null;
  sold: number;
};

function StatusChip({ art }: { art: GridArt }) {
  if (art.status === "REJECTED")
    return <span className="rounded-full bg-coral px-2.5 py-0.5 text-[12px] font-bold text-white">Rejected</span>;
  if (art.status === "PENDING")
    return <span className="rounded-full border-[1.5px] border-ink bg-sticker px-2.5 py-0.5 text-[12px] font-bold" title="Usually within a day">In review</span>;
  if (art.sensitive.length)
    return <span className="rounded-full border-[1.5px] border-ink bg-sticker px-2.5 py-0.5 text-[12px] font-bold" title={art.sensitive.join(", ")}>Sensitive · blurred</span>;
  return (
    <span className="flex items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-white px-2.5 py-0.5 text-[12px] font-bold">
      <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: "#2b37f0" }} />Live
    </span>
  );
}

export default function ArtGrid({ items, handle }: { items: GridArt[]; handle: string }) {
  const router = useRouter();
  const [list, setList] = useState(items);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // "Add codes to print queue": pick pieces, pick a look.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [look, setLook] = useState("last");
  const selectable = list.filter((a) => a.status !== "REJECTED");
  const toggle = (slug: string) => setPicked((o) => { const n = new Set(o); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  async function queuePicked() {
    const slugs = Array.from(picked);
    if (!slugs.length) return;
    setBusy("queue");
    try {
      const res = await fetch("/api/studio/print-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slugs, look }) });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't add them to your print queue. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : queuePicked });
        return;
      }
      const j = await res.json().catch(() => ({}));
      saved(`Added ${j.added} ${j.added === 1 ? "code" : "codes"} to your print queue`, { description: `${j.formatName}s, one of each. Set quantities in the queue.`, next: { label: "Open print queue", href: "/studio/qr/queue" } });
      setPicked(new Set());
      setSelecting(false);
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't add them to your print queue. Try again."), { retry: queuePicked });
    } finally {
      setBusy(null);
    }
  }

  async function remove(a: GridArt) {
    setBusy(a.slug);
    try {
      const res = await fetch(`/api/artworks/${encodeURIComponent(a.slug)}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const p = await problemFrom(res, `Couldn't delete ${a.title}. Try again.`);
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => remove(a) });
        return;
      }
      setList((l) => l.filter((x) => x.id !== a.id));
      saved(`Deleted ${a.title}`, { description: a.sold > 0 ? "Past sales stay in your records." : undefined });
      router.refresh();
    } catch (e) {
      failed(errorText(e, `Couldn't delete ${a.title}. Try again.`), { retry: () => remove(a) });
    } finally {
      setBusy(null);
      setConfirming(null);
    }
  }

  if (!list.length) {
    return (
      <EmptyState
        dab="#e8743b"
        title="No paintings yet"
        body="Upload your first and its QR code is ready to print. Buyers order prints in four sizes; we print, frame and ship."
        action={{ label: "Upload art", href: "/studio/art/new" }}
        help={{ label: "How uploading works", href: "/help/getting-started/upload-art" }}
      />
    );
  }

  return (
    <div className="grid gap-4">
    {selectable.length > 0 && (
      <div className="flex flex-wrap items-center gap-2">
        {selecting ? (
          <>
            <span className="text-[14px] font-semibold text-ink-2">Pick the pieces whose codes you want to print.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(picked.size === selectable.length ? new Set() : new Set(selectable.map((a) => a.slug)))}>
              {picked.size === selectable.length ? "Clear all" : `Select all (${selectable.length})`}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSelecting(false); setPicked(new Set()); }}>Cancel</button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelecting(true)}>Select pieces to print codes</button>
        )}
      </div>
    )}
    <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-5 xl:grid-cols-5">
      {list.map((a) => (
        <li key={a.id} className="grid content-start gap-2">
          <div className="relative">
            <Link href={`/studio/art/${a.slug}`} className="block aspect-[4/5] overflow-hidden rounded-[3px] bg-gallery shadow-[0_2px_0_var(--af-line),0_10px_24px_-14px_rgba(21,22,27,.4)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.imageUrl} alt={a.title} className={cn("h-full w-full object-cover transition hover:scale-[1.03]", a.status === "REJECTED" && "opacity-50 grayscale")} />
            </Link>
            <div className="absolute left-2 top-2"><StatusChip art={a} /></div>
            {selecting && a.status !== "REJECTED" && (
              <label className="absolute right-1 top-1 grid h-11 w-11 cursor-pointer place-items-center">
                <input type="checkbox" checked={picked.has(a.slug)} onChange={() => toggle(a.slug)} className="h-6 w-6 accent-[rgb(var(--af-scan-rgb))]" aria-label={`Print ${a.title}'s code`} />
              </label>
            )}
            {confirming === a.id && (
              <div role="alertdialog" aria-label={`Delete ${a.title}?`} className="absolute inset-0 grid place-content-center gap-3 rounded-[3px] bg-white/95 p-3 text-center">
                <b className="font-display text-[20px] [font-variation-settings:'wdth'_80]">Delete for good?</b>
                {a.sold > 0 && <span className="text-[12.5px] text-ink-2">Past sales stay in your records.</span>}
                <div className="flex justify-center gap-2">
                  <button type="button" className="btn btn-sm border-coral bg-coral" disabled={busy === a.slug} onClick={() => remove(a)} autoFocus>
                    {busy === a.slug ? "Deleting" : "Delete"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirming(null)}>Keep</button>
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <b className="block truncate text-[15px]">{a.title}</b>
            <span className="num text-[12.5px] text-ink-2">
              {a.status === "REJECTED" && a.flaggedReason ? a.flaggedReason : a.status === "PENDING" ? "In review — usually within a day" : a.sold ? `${a.sold} sold` : "No sales yet"}
            </span>
          </div>
          <div className="-mb-2 flex flex-wrap gap-x-3.5 text-[14px] font-semibold [&>*]:inline-flex [&>*]:min-h-[44px] [&>*]:items-center lg:mb-0 lg:gap-y-1 lg:text-[13px] lg:[&>*]:min-h-0">
            <Link href={`/studio/art/${a.slug}`} className="text-scan">Edit</Link>
            <Link href={`/studio/qr?art=${a.slug}`} className="text-scan">Print code</Link>
            <Link href={`/studio/share?art=${a.slug}`} className="text-scan">Share</Link>
            <Link href={`/studio/rooms?art=${a.slug}`} className="text-scan">Rooms</Link>
            <Link href={artPath(handle, a.slug)} className="text-scan">View</Link>
            <button type="button" className="ml-auto text-ink-2 hover:text-coral" onClick={() => setConfirming(a.id)} aria-label={`Delete ${a.title}`}>Delete</button>
          </div>
        </li>
      ))}
    </ul>
    {selecting && (
      <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border-[1.5px] border-ink bg-white p-3 shadow-[0_10px_30px_-10px_rgba(21,22,27,.35)]" role="region" aria-label="Add codes to print queue">
        <b className="num text-[15px]" aria-live="polite">{picked.size} selected</b>
        <label className="flex items-center gap-1.5 text-[13.5px] font-semibold">
          Look
          <select value={look} onChange={(e) => setLook(e.target.value)} className="min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px]">
            <option value="last">My last-used look</option>
            <option value="gallery">Gallery label</option>
            <option value="sticker">Round sticker</option>
            <option value="market">Market tag</option>
            <option value="poster">Show poster</option>
          </select>
        </label>
        <button type="button" className="btn btn-blue btn-sm ml-auto" disabled={!picked.size || busy === "queue"} onClick={queuePicked}>
          {busy === "queue" ? "Adding…" : "Add codes to print queue"}
        </button>
      </div>
    )}
    </div>
  );
}
