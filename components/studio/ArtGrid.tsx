"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, Eye, MapPin, Printer, QrCode, Share2, X } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import PlacePicker, { NO_PLACE, placeInput, type PartnerChoice, type PlaceChoice, type PlaceValue } from "@/components/codes/PlacePicker";
import { EmptyState } from "./EmptyState";
import { SortMenu, useSortPref, type SortOption } from "./SortMenu";
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
  /** All-time scans of this piece's codes. */
  scans: number;
  /** ISO date, for Newest / Oldest. */
  createdAt: string;
  /** The Place it hangs at now (lib/artistPlaces.ts), if any. */
  hangingAt?: string | null;
};

type SortKey = "newest" | "oldest" | "title" | "sold" | "scans";
type ShowKey = "all" | "live" | "review" | "hidden";

const SORTS: SortOption<SortKey>[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title", label: "Title A–Z" },
  { value: "sold", label: "Best selling" },
  { value: "scans", label: "Most scanned" },
];
const SORT_KEYS = SORTS.map((s) => s.value);
const SHOW_KEYS: ShowKey[] = ["all", "live", "review", "hidden"];
const SHOW_STATUS: Record<Exclude<ShowKey, "all">, GridArt["status"]> = { live: "APPROVED", review: "PENDING", hidden: "REJECTED" };

const STATUS: Record<GridArt["status"], { label: string; dot: string; tip: string }> = {
  APPROVED: { label: "Live", dot: "#0f9d58", tip: "Live on your page" },
  PENDING: { label: "In review", dot: "#f2a900", tip: "We check new art, usually within a day" },
  REJECTED: { label: "Hidden", dot: "#ff5a36", tip: "Hidden from buyers" },
};

function StatusPill({ art }: { art: GridArt }) {
  const s = STATUS[art.status];
  const blurred = art.status === "APPROVED" && art.sensitive.length > 0;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-bold leading-none text-ink shadow-[0_1px_4px_rgba(21,22,27,.18)]"
      title={blurred ? `Live, blurred for buyers (${art.sensitive.join(", ")})` : art.status === "REJECTED" && art.flaggedReason ? art.flaggedReason : s.tip}
    >
      <i aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: s.dot }} />
      {s.label}
      {blurred && <span className="font-semibold text-ink-2">· blurred</span>}
    </span>
  );
}

function sortArt(list: GridArt[], sort: SortKey) {
  const out = [...list];
  const byNew = (a: GridArt, b: GridArt) => b.createdAt.localeCompare(a.createdAt);
  if (sort === "oldest") out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  else if (sort === "title") out.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
  else if (sort === "sold") out.sort((a, b) => b.sold - a.sold || byNew(a, b));
  else if (sort === "scans") out.sort((a, b) => b.scans - a.scans || byNew(a, b));
  else out.sort(byNew);
  return out;
}

export default function ArtGrid({ items, handle, places = [], partners = [] }: { items: GridArt[]; handle: string; places?: PlaceChoice[]; partners?: PartnerChoice[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [sort, setSort] = useSortPref<SortKey>("studio-art", "newest", SORT_KEYS);
  const [show, setShow] = useSortPref<ShowKey>("studio-art-status", "all", SHOW_KEYS);

  // Pick pieces, then either "Add codes to print queue" (pick a look) or "Hang at a place".
  const [mode, setMode] = useState<"print" | "place" | null>(null);
  const selecting = mode !== null;
  const setSelecting = (on: boolean) => setMode(on ? "print" : null);
  const [target, setTarget] = useState<PlaceValue>(NO_PLACE);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [look, setLook] = useState("last");
  const selectable = items.filter((a) => a.status !== "REJECTED");
  const toggle = (slug: string) => setPicked((o) => { const n = new Set(o); if (n.has(slug)) n.delete(slug); else n.add(slug); return n; });

  const counts = useMemo(() => ({
    all: items.length,
    live: items.filter((a) => a.status === "APPROVED").length,
    review: items.filter((a) => a.status === "PENDING").length,
    hidden: items.filter((a) => a.status === "REJECTED").length,
  }), [items]);
  // Only offer the filters that would show something (plus whatever is picked now).
  const showOptions: SortOption<ShowKey>[] = [
    { value: "all", label: `All (${counts.all})` },
    ...(counts.live || show === "live" ? [{ value: "live" as const, label: `Live (${counts.live})` }] : []),
    ...(counts.review || show === "review" ? [{ value: "review" as const, label: `In review (${counts.review})` }] : []),
    ...(counts.hidden || show === "hidden" ? [{ value: "hidden" as const, label: `Hidden (${counts.hidden})` }] : []),
  ];
  const visible = useMemo(
    () => sortArt(show === "all" ? items : items.filter((a) => a.status === SHOW_STATUS[show]), sort),
    [items, show, sort],
  );

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

  async function hangPicked() {
    const ids = items.filter((a) => picked.has(a.slug)).map((a) => a.id);
    if (!ids.length) return;
    setBusy("hang");
    try {
      const res = await fetch("/api/studio/hangings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artworkIds: ids, place: placeInput(target) }) });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't save that. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : hangPicked });
        return;
      }
      const j = await res.json().catch(() => ({}));
      saved(j.place ? `${ids.length} ${ids.length === 1 ? "piece hangs" : "pieces hang"} at ${j.place.name}` : `${ids.length} ${ids.length === 1 ? "piece is" : "pieces are"} back home`, j.place ? { description: "Print their codes from the place's page.", next: { label: `Open ${j.place.name}`, href: `/studio/places/${j.place.id}` } } : undefined);
      setPicked(new Set());
      setMode(null);
      setTarget(NO_PLACE);
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't save that. Try again."), { retry: hangPicked });
    } finally {
      setBusy(null);
    }
  }

  if (!items.length) {
    return (
      <EmptyState
        dab="#e8743b"
        title="No paintings yet"
        body="Upload one and its QR code is ready to print. Your first few pieces get a quick review from our moderation team, usually within a day."
        action={{ label: "Upload art", href: "/studio/art/new" }}
        help={{ label: "How uploading works", href: "/help/getting-started/upload-art" }}
      />
    );
  }

  const allPicked = picked.size === selectable.length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {selecting ? (
          <>
            <span className="t-muted mr-auto font-semibold">{mode === "place" ? "Pick pieces to hang somewhere" : "Pick pieces to print codes for"}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(allPicked ? new Set() : new Set(selectable.map((a) => a.slug)))}>
              <Check className="h-4 w-4" aria-hidden="true" />
              {allPicked ? "Clear all" : `All (${selectable.length})`}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSelecting(false); setPicked(new Set()); }}>
              <X className="h-4 w-4" aria-hidden="true" />Cancel
            </button>
          </>
        ) : (
          <>
            <SortMenu label="Sort" value={sort} onChange={setSort} options={SORTS} />
            {showOptions.length > 2 && <SortMenu label="Show" kind="filter" value={show} onChange={setShow} options={showOptions} />}
            {selectable.length > 0 && (
              <span className="ml-auto flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost btn-sm min-h-[40px]" onClick={() => setMode("place")} title="Pick pieces and say where they hang: a café, gallery, market or show">
                  <MapPin className="h-4 w-4" aria-hidden="true" />Hang at a place
                </button>
                <button type="button" className="btn btn-ghost btn-sm min-h-[40px]" onClick={() => setMode("print")} title="Pick pieces and add their codes to your print queue">
                  <Printer className="h-4 w-4" aria-hidden="true" />Print codes
                </button>
              </span>
            )}
          </>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          compact
          dab="#e8743b"
          title="Nothing here"
          body="No pieces match this filter."
          action={{ label: "Show all", onClick: () => setShow("all") }}
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 lg:gap-5 xl:grid-cols-5">
          {visible.map((a) => {
            const hidden = a.status === "REJECTED";
            const canPick = selecting && !hidden;
            const live = artPath(handle, a.slug);
            const meta = hidden
              ? a.flaggedReason || "Hidden from buyers. Open to see why."
              : a.status === "PENDING"
                ? "In review, usually within a day"
                : [a.hangingAt ? `At ${a.hangingAt}` : "", a.sold ? `${a.sold} sold` : "No sales yet", a.scans ? `${a.scans} ${a.scans === 1 ? "scan" : "scans"}` : ""].filter(Boolean).join(" · ");
            const actions = [
              { href: `/studio/qr?art=${a.slug}`, icon: QrCode, short: "QR", label: "QR code", tip: "Print its QR code", aria: `QR code for ${a.title}` },
              { href: live, icon: Eye, short: "Page", label: "Live page", tip: "View live page", aria: `View live page for ${a.title}`, external: true },
              { href: `/studio/share?art=${a.slug}`, icon: Share2, short: "Social", label: "Social", tip: "Posts and stories for this piece", aria: `Share ${a.title} on social` },
            ];
            return (
              <li key={a.id} className="group grid content-start gap-2">
                <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-gallery ring-1 ring-inset ring-black/5">
                  {canPick ? (
                    <label className="absolute inset-0 z-[1] cursor-pointer">
                      <input type="checkbox" checked={picked.has(a.slug)} onChange={() => toggle(a.slug)} className="absolute right-2.5 top-2.5 h-6 w-6 accent-[rgb(var(--af-scan-rgb))]" aria-label={mode === "place" ? `Pick ${a.title}` : `Print ${a.title}'s code`} />
                    </label>
                  ) : (
                    <Link href={`/studio/art/${a.slug}`} className="absolute inset-0 z-[1] rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-scan" aria-label={`Edit ${a.title}`} title="Edit" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.imageUrl} alt="" className={cn("h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] motion-reduce:transition-none", hidden && "opacity-50 grayscale", canPick && picked.has(a.slug) && "opacity-80")} />
                  <div className="pointer-events-none absolute left-2 top-2 z-[2]"><StatusPill art={a} /></div>
                  {/* Quick actions: fade in on hover or keyboard focus. Touch screens get the row under the title instead. */}
                  {!hidden && !selecting && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end gap-1.5 bg-gradient-to-t from-black/55 to-transparent p-2 pt-10 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:hidden">
                      {actions.map((x) => {
                        const Icon = x.icon;
                        const cls = "pointer-events-auto grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-[0_1px_4px_rgba(21,22,27,.25)] hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
                        return x.external ? (
                          <a key={x.label} href={x.href} target="_blank" rel="noopener" aria-label={x.aria} title={x.tip} className={cls}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></a>
                        ) : (
                          <Link key={x.label} href={x.href} aria-label={x.aria} title={x.tip} className={cls}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></Link>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="min-w-0 px-0.5">
                  <Link href={`/studio/art/${a.slug}`} className="block truncate text-[15px] font-bold text-ink no-underline hover:underline" tabIndex={-1}>{a.title}</Link>
                  <span className={cn("t-small num block truncate", hidden && "!text-coral")} title={meta}>{meta}</span>
                </div>
                {!hidden && !selecting && (
                  <div className="-mt-1 hidden items-center justify-between gap-1 text-[13px] font-semibold text-scan [@media(hover:none)]:flex">
                    {actions.map((x) => {
                      const Icon = x.icon;
                      const inner = <><Icon className="h-[15px] w-[15px] shrink-0" aria-hidden="true" /><span className="sm:hidden">{x.short}</span><span className="max-sm:hidden">{x.label}</span></>;
                      const cls = "inline-flex min-h-[40px] items-center gap-1";
                      return x.external ? (
                        <a key={x.label} href={x.href} target="_blank" rel="noopener" aria-label={x.aria} className={cls}>{inner}</a>
                      ) : (
                        <Link key={x.label} href={x.href} aria-label={x.aria} className={cls}>{inner}</Link>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {mode === "place" && (
        <div className="sticky bottom-3 z-20 grid gap-2 rounded-2xl border border-edge bg-white p-3 shadow-[0_10px_30px_-10px_rgba(21,22,27,.35)] sm:flex sm:flex-wrap sm:items-end" role="region" aria-label="Hang at a place">
          <b className="num text-[15px] sm:self-center" aria-live="polite">{picked.size} selected</b>
          <div className="grid min-w-0 gap-2 sm:w-[280px]">
            <PlacePicker places={places} partners={partners} value={target} onChange={setTarget} label="Hanging at" noneLabel="At home" />
          </div>
          <button type="button" className="btn btn-blue btn-sm sm:ml-auto" disabled={!picked.size || busy === "hang"} onClick={hangPicked}>
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {busy === "hang" ? "Saving…" : placeInput(target) ? "Hang them there" : "Mark as back home"}
          </button>
        </div>
      )}

      {mode === "print" && (
        <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-edge bg-white p-3 shadow-[0_10px_30px_-10px_rgba(21,22,27,.35)]" role="region" aria-label="Add codes to print queue">
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
            <Printer className="h-4 w-4" aria-hidden="true" />
            {busy === "queue" ? "Adding…" : "Add codes to print queue"}
          </button>
        </div>
      )}
    </div>
  );
}
