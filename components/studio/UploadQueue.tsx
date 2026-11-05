"use client";
// Several paintings at once, inside the normal upload flow (/studio/art/new). The artist picks several files or a
// folder; they upload in the background through POST /api/uploads (a few at a time) while the artist fills in each
// painting in the familiar single form and publishes it through POST /api/artworks/upload, one by one.
// Prices, print run and labels carry over from the previous painting; the ownership box is ticked once for the batch.
// The queue is kept in sessionStorage so a refresh doesn't lose the titles typed so far.
// Paintings picked in Google Drive or Dropbox (./cloudImport.tsx) join the same queue: they go through
// POST /api/uploads/import instead, which runs the same pipeline and returns the same result as /api/uploads.
import Link from "next/link";
import { DragEvent, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, Check, FolderOpen, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { SizeKey } from "@/lib/earnings";
import { cn } from "@/lib/utils";
import { artPath } from "@/lib/urls";
import { MAX_UPLOAD_BYTES, QUEUE_CONCURRENCY, QUEUE_MAX } from "@/lib/uploadLimits";
import {
  artworkFormData, checkArtwork, DetailsFields, EditionField, filesFromDrop, isImageFile, OwnershipField, PriceFields,
  pricesFrom, PrintSizes, REVIEW_NOTE, SensitiveField, saveError, sortFiles, titleFromFile, useLastPrices, usePriceGuide,
  type ArtworkValues, type Prices,
} from "./artworkFields";
import { CloudImportButtons, ImportFailed, importCloudFile, importingLabel, isCloudImage, SOURCE_LABEL, type CloudFile, type CloudSource } from "./cloudImport";

type Result = {
  state: "live" | "review" | "failed";
  id?: string;
  slug?: string;
  title?: string;
  imageUrl?: string;
  notice?: string | null;
  duplicate?: string | null;
  error?: string;
};

export type QueueItem = {
  id: string;
  name: string;
  upload: "waiting" | "uploading" | "done" | "error";
  progress: number;
  uploadError?: string;
  imageUrl: string;
  fresh: { printable: SizeKey[]; sig: string } | null;
  dims: { w: number; h: number } | null;
  v: ArtworkValues;
  /** Prices, print run and labels follow the previous painting until the artist changes them here. */
  carry: boolean;
  result?: Result;
  /** Picked in Google Drive / Dropbox: imported by the server rather than uploaded from this device. */
  source?: CloudSource;
};

export type QueueDraft = { items: QueueItem[]; index: number; owned: boolean; announced: string[]; finished: boolean };

const draftKey = (handle: string) => `af.uploadQueue.${handle}`;

/** The saved queue, if any. Only uploaded images survive a reload (the files themselves can't be kept). */
export function readDraft(handle: string): { draft: QueueDraft; dropped: number } | null {
  try {
    const raw = window.sessionStorage.getItem(draftKey(handle));
    const d = raw ? (JSON.parse(raw) as QueueDraft) : null;
    if (!d || !Array.isArray(d.items) || !d.items.length) return null;
    const items = d.items.filter((i) => i.upload === "done" && i.imageUrl);
    if (!items.length) return null;
    const kept = d.items[d.index]?.id;
    const index = Math.max(0, items.findIndex((i) => i.id === kept));
    return { draft: { ...d, items, index, announced: d.announced || [] }, dropped: d.items.length - items.length };
  } catch {
    return null;
  }
}

function writeDraft(handle: string, d: QueueDraft | null) {
  try {
    if (d) window.sessionStorage.setItem(draftKey(handle), JSON.stringify(d));
    else window.sessionStorage.removeItem(draftKey(handle));
  } catch {
    /* private mode, full storage: the queue still works, it just won't survive a reload */
  }
}

const TOO_BIG = `That file is over ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`;

const BLANK: Omit<ArtworkValues, "title" | "prices"> = { description: "", origW: "", origH: "", sensitive: [], limited: false, edition: "25" };
const uid = () => Math.random().toString(36).slice(2, 10);

/** Ready to publish? null = yes, otherwise what's missing (for the thumbnail dot). */
function missing(it: QueueItem, owned: boolean): string | null {
  if (it.upload === "error") return "upload failed";
  if (it.upload !== "done") return null; // still uploading: not a problem yet
  if (it.result?.state === "failed") return "didn't publish";
  return checkArtwork(it.v, { imageUrl: it.imageUrl, printable: it.fresh?.printable ?? null, needsOwnership: false, owned })?.message ?? null;
}

const published = (it: QueueItem) => it.result?.state === "live" || it.result?.state === "review";

export default function UploadQueue({ handle, split, files: initialFiles, cloud: initialCloud, mock, restored, onExit }: {
  handle: string;
  split?: number;
  files?: File[];
  /** Picked in Google Drive / Dropbox before the queue opened. */
  cloud?: CloudFile[];
  /** Dev-only sample import button (ALLOW_MOCK_IMPORT=1). */
  mock?: boolean;
  restored?: { draft: QueueDraft; dropped: number };
  onExit: () => void;
}) {
  const files = useRef(new Map<string, File>());
  // Picked cloud files (with the short-lived Drive token): memory only, never in the saved draft.
  const remotes = useRef(new Map<string, CloudFile>());
  const previews = useRef(new Map<string, string>());
  const xhrs = useRef(new Map<string, { abort(): void }>());
  const active = useRef(new Set<string>());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const focusHeading = useRef(false);
  const startPrices = useRef<Prices>(pricesFrom(null));

  const [notice, setNotice] = useState<string | null>(() =>
    restored?.dropped ? `${restored.dropped} ${restored.dropped === 1 ? "image was" : "images were"} still uploading when the page reloaded. Add ${restored.dropped === 1 ? "it" : "them"} again.` : null,
  );
  const [items, setItems] = useState<QueueItem[]>(() => restored?.draft.items ?? []);
  const [index, setIndex] = useState(() => restored?.draft.index ?? 0);
  const [owned, setOwned] = useState(() => restored?.draft.owned ?? false);
  const [announced, setAnnounced] = useState<string[]>(() => restored?.draft.announced ?? []);
  const [finished, setFinished] = useState(() => restored?.draft.finished ?? false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ itemId: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const guide = usePriceGuide();

  const patch = useCallback((id: string, p: Partial<QueueItem> | ((it: QueueItem) => Partial<QueueItem>)) => {
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...(typeof p === "function" ? p(it) : p) } : it)));
  }, []);

  const itemsRef = useRef(items);
  itemsRef.current = items;

  /** Adds files to the queue: images only, up to QUEUE_MAX, in folder/name order (device files) or picked order (cloud). */
  const add = useCallback((list: (File | CloudFile)[]) => {
    const local = list.filter((f): f is File => f instanceof File);
    const remote = list.filter((f): f is CloudFile => !(f instanceof File));
    const images: (File | CloudFile)[] = [...sortFiles(local.filter(isImageFile)), ...remote.filter(isCloudImage)];
    const cur = itemsRef.current;
    const take = images.slice(0, Math.max(0, QUEUE_MAX - cur.length));
    const skipped = list.length - images.length;
    const over = images.length - take.length;
    const notes = [
      over > 0 && `That's more than ${QUEUE_MAX} at once, so ${over} ${over === 1 ? "image was" : "images were"} left out. Add them in another batch.`,
      skipped > 0 && `${skipped} ${skipped === 1 ? "file isn't an image" : "files aren't images"} and ${skipped === 1 ? "was" : "were"} skipped.`,
    ].filter(Boolean);
    setNotice(notes.length ? notes.join(" ") : null);
    // New paintings start from the last one in the queue (or the artist's last prices).
    const last = cur[cur.length - 1]?.v;
    const added: QueueItem[] = take.map((f) => {
      const id = uid();
      const isFile = f instanceof File;
      if (isFile) {
        files.current.set(id, f);
        previews.current.set(id, URL.createObjectURL(f));
      } else {
        remotes.current.set(id, f);
      }
      const big = (isFile ? f.size : f.bytes || 0) > MAX_UPLOAD_BYTES;
      return {
        id, name: f.name, upload: big ? "error" : "waiting", progress: 0, uploadError: big ? TOO_BIG : undefined,
        imageUrl: "", fresh: null, dims: null, carry: true, source: isFile ? undefined : f.source,
        v: { ...BLANK, title: titleFromFile(f.name), prices: last?.prices ?? startPrices.current, sensitive: last?.sensitive ?? [], limited: last?.limited ?? false, edition: last?.edition ?? "25" },
      };
    });
    if (added.length) setItems((c) => [...c, ...added].slice(0, QUEUE_MAX));
  }, []);

  // First files from the picker.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (initialFiles?.length || initialCloud?.length) add([...(initialFiles || []), ...(initialCloud || [])]);
  }, [initialFiles, initialCloud, add]);

  // The artist's last prices, for paintings nobody has touched yet.
  useLastPrices(!restored, (prices) => {
    startPrices.current = prices;
    setItems((cur) => cur.map((it) => (it.carry && !it.result ? { ...it, v: { ...it.v, prices } } : it)));
  });

  // Background uploads, QUEUE_CONCURRENCY at a time.
  useEffect(() => {
    for (const it of items) {
      if (active.current.size >= QUEUE_CONCURRENCY) break;
      if (it.upload !== "waiting" || active.current.has(it.id)) continue;
      const id = it.id;
      const end = (p: Partial<QueueItem>) => {
        active.current.delete(id);
        xhrs.current.delete(id);
        patch(id, p);
      };
      const done = (data: { url: string; width?: number; height?: number; printable?: SizeKey[]; printableSig?: string }) =>
        end({ upload: "done", progress: 1, imageUrl: data.url, fresh: { printable: data.printable || [], sig: data.printableSig || "" }, dims: data.width ? { w: data.width, h: data.height || 0 } : null });

      // Picked in Drive / Dropbox: the server downloads it (no byte progress to show, so the bar just pulses).
      const remote = remotes.current.get(id);
      if (remote) {
        active.current.add(id);
        const ctrl = new AbortController();
        xhrs.current.set(id, ctrl);
        patch(id, { upload: "uploading", progress: 0, uploadError: undefined });
        importCloudFile(remote, ctrl.signal).then(
          (data) => done({ ...data, printable: data.printable as SizeKey[] }),
          (e) => {
            if (ctrl.signal.aborted) { active.current.delete(id); xhrs.current.delete(id); return; }
            // Some failures (expired Drive access or Dropbox link) need the file picked again, not a retry.
            if (e instanceof ImportFailed && !e.retry) remotes.current.delete(id);
            end({ upload: "error", uploadError: e?.message || "Import failed. Try again." });
          },
        );
        continue;
      }

      const file = files.current.get(id);
      if (!file) { patch(id, { upload: "error", uploadError: "Add this image again." }); continue; }
      active.current.add(id);
      const xhr = new XMLHttpRequest();
      xhrs.current.set(id, xhr);
      patch(id, { upload: "uploading", progress: 0, uploadError: undefined });
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) patch(id, { progress: e.loaded / e.total }); };
      xhr.onload = () => {
        let data: any = {};
        try { data = JSON.parse(xhr.responseText); } catch {}
        if (xhr.status >= 200 && xhr.status < 300 && data.url) {
          done(data);
        } else {
          end({ upload: "error", uploadError: data.error || (xhr.status === 401 ? "You're logged out. Log in and add it again." : "Upload failed. Try again.") });
        }
      };
      xhr.onerror = () => end({ upload: "error", uploadError: "Upload failed. Check your connection and try again." });
      xhr.onabort = () => { active.current.delete(id); xhrs.current.delete(id); };
      const fd = new FormData();
      fd.append("file", file);
      xhr.open("POST", "/api/uploads");
      xhr.withCredentials = true;
      xhr.send(fd);
    }
  }, [items, patch]);

  // Running uploads stop when the queue goes (object URLs are freed on remove / start over).
  useEffect(() => {
    const x = xhrs.current;
    return () => x.forEach((r) => r.abort());
  }, []);

  // Keep the queue across an accidental refresh.
  useEffect(() => {
    if (!items.length) return;
    writeDraft(handle, { items, index, owned, announced, finished });
  }, [handle, items, index, owned, announced, finished]);

  // Warn before leaving while images are still uploading or a painting is publishing.
  const busy = publishing !== null || items.some((i) => i.upload === "waiting" || i.upload === "uploading");
  useEffect(() => {
    if (!busy) return;
    const warn = "Your images are still uploading. Leave anyway?";
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = warn; return warn; };
    // In-app links don't fire beforeunload, so ask on those too.
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (!window.confirm(warn)) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [busy]);

  // Moving to another painting puts focus on its heading, so screen readers hear "Painting 4 of 12".
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [index, finished]);

  // The batch ends: one summary email for the pieces published in it (lib/artworkLive.ts announceBatch).
  useEffect(() => {
    if (!finished) return;
    const ids = items.filter((i) => published(i) && i.result?.id && !announced.includes(i.result.id)).map((i) => i.result!.id!);
    if (!ids.length) return;
    setAnnounced((a) => [...a, ...ids]);
    fetch("/api/artworks/upload/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }), credentials: "include" }).catch(() => {});
  }, [finished, items, announced]);

  const item = items[index] as QueueItem | undefined;
  const total = items.length;
  const done = items.filter(published);
  const uploadedCount = items.filter((i) => i.upload === "done").length;
  const left = items.filter((i) => !published(i));

  /** "Same as last one": an untouched painting takes the prices, run and labels of `from`. */
  const carryInto = (list: QueueItem[], toId: string, from: ArtworkValues) =>
    list.map((it) => (it.id === toId && it.carry && !it.result ? { ...it, v: { ...it.v, prices: from.prices, limited: from.limited, edition: from.edition, sensitive: from.sensitive } } : it));

  function go(to: number) {
    if (!item || to < 0 || to >= items.length || to === index) return;
    setError(null);
    setBanner(null);
    const toId = items[to].id, from = item.v;
    setItems((cur) => carryInto(cur, toId, from));
    focusHeading.current = true;
    setIndex(to);
  }

  /** Next painting still to publish after `from` (wrapping round), or -1. */
  const nextOpen = (list: QueueItem[], from: number) => {
    for (let k = 1; k <= list.length; k++) {
      const j = (from + k) % list.length;
      if (!published(list[j])) return j;
    }
    return -1;
  };

  function remove(id: string) {
    xhrs.current.get(id)?.abort();
    active.current.delete(id);
    files.current.delete(id);
    remotes.current.delete(id);
    const u = previews.current.get(id);
    if (u) URL.revokeObjectURL(u);
    previews.current.delete(id);
    const at = itemsRef.current.findIndex((i) => i.id === id);
    const next = itemsRef.current.filter((i) => i.id !== id);
    setItems((cur) => cur.filter((i) => i.id !== id));
    setError(null);
    setBanner(null);
    if (!next.length) { writeDraft(handle, null); onExit(); return; }
    focusHeading.current = true;
    if (!next.some((i) => !published(i))) { setFinished(true); return; }
    setIndex(Math.min(Math.max(0, at), next.length - 1));
  }

  function setV(patchV: Partial<ArtworkValues>, carrySafe = true) {
    if (!item) return;
    patch(item.id, (it) => ({ v: { ...it.v, ...patchV }, carry: carrySafe ? it.carry : false }));
  }

  function fail(message: string, focus?: string) {
    setError(message);
    requestAnimationFrame(() => {
      const el = focus ? document.getElementById(focus) : null;
      (el || errorRef.current)?.focus();
    });
  }

  async function publish() {
    if (!item || publishing) return;
    setError(null);
    setBanner(null);
    if (item.upload !== "done") { fail(item.upload === "error" ? item.uploadError || "Upload failed. Try again." : "Still uploading. One moment."); return; }
    const problem = checkArtwork(item.v, { imageUrl: item.imageUrl, printable: item.fresh?.printable ?? null, needsOwnership: true, owned });
    if (problem) { fail(problem.message, problem.focus); return; }
    const id = item.id;
    setPublishing(id);
    let result: Result;
    try {
      const res = await fetch("/api/artworks/upload", {
        method: "POST", credentials: "include",
        body: artworkFormData(item.v, { imageUrl: item.imageUrl, fresh: item.fresh, ownership: owned, batch: true }),
      });
      if (!res.ok) throw new Error(await saveError(res));
      const saved = await res.json();
      result = { state: saved.status === "PENDING" ? "review" : "live", id: saved.id, slug: saved.slug, title: saved.title, imageUrl: saved.imageUrl, notice: saved.notice, duplicate: saved.duplicate };
    } catch (e: any) {
      result = { state: "failed", error: e?.message || "Could not save. Try again." };
    }
    setPublishing(null);
    setItems((cur) => cur.map((it) => (it.id === id ? { ...it, result } : it)));
    if (result.state === "failed") { fail(result.error!); return; }
    setBanner({ itemId: id });
    // Uploads keep patching the list while this saved, so work from the latest copy.
    const list = itemsRef.current.map((it) => (it.id === id ? { ...it, result } : it));
    const to = nextOpen(list, Math.max(0, list.findIndex((it) => it.id === id)));
    focusHeading.current = true;
    if (to === -1) { setFinished(true); return; }
    const toId = list[to].id, from = item.v;
    setItems((cur) => carryInto(cur, toId, from));
    setIndex(to);
  }

  function finishNow() {
    const n = left.length;
    if (n && !window.confirm(`${n} ${n === 1 ? "painting isn't" : "paintings aren't"} published yet. Finish without ${n === 1 ? "it" : "them"}?`)) return;
    xhrs.current.forEach((r) => r.abort());
    setItems((cur) => cur.filter(published));
    focusHeading.current = true;
    setFinished(true);
  }

  function startOver() {
    previews.current.forEach((u) => URL.revokeObjectURL(u));
    writeDraft(handle, null);
    onExit();
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    add(await filesFromDrop(e.dataTransfer));
  }

  useEffect(() => { folderRef.current?.setAttribute("webkitdirectory", ""); }, [finished]);

  const thumb = (it: QueueItem) => it.imageUrl || previews.current.get(it.id) || "";
  const bannerItem = banner ? items.find((i) => i.id === banner.itemId) : undefined;

  if (finished) return <Summary items={items.filter(published)} handle={handle} onMore={startOver} headingRef={headingRef} />;
  if (!item) return null;

  const problem = missing(item, owned);
  const printable = item.fresh?.printable ?? null;
  const ready = (s: SizeKey) => !printable || printable.includes(s);
  const sameNote = item.carry && index > 0 && !item.result ? <span className="font-semibold text-ink">Same as last one</span> : undefined;

  return (
    <div className="grid gap-5" onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }} onDrop={onDrop}>
      {/* Progress header + queue strip */}
      <section aria-label="Upload queue" className={cn("af-card grid gap-3 p-3 sm:p-4", dragging && "outline outline-[3px] outline-scan")}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-[24px] font-bold outline-none [font-variation-settings:'wdth'_80]">
            Painting <span className="num">{index + 1}</span> of <span className="num">{total}</span>
          </h2>
          <p className="text-[13.5px] text-ink-2" aria-live="polite">
            <span className="num">{done.length}</span> published · <span className="num">{left.length}</span> to go
            {uploadedCount < total && <> · {items.some((i) => i.source && i.upload !== "done") ? "importing" : "uploading"} <span className="num">{uploadedCount}</span>/<span className="num">{total}</span></>}
          </p>
        </div>
        <ol className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-0.5" aria-label="Paintings in this batch">
          {items.map((it, i) => {
            const m = missing(it, owned);
            const state = it.result?.state === "live" ? "Live" : it.result?.state === "review" ? "In review" : it.upload === "uploading" || it.upload === "waiting" ? (it.source ? importingLabel(it.source) : "Uploading") : m ? `Needs info: ${m}` : "Ready";
            return (
              <li key={it.id} className="shrink-0">
                <button
                  type="button" onClick={() => go(i)} aria-current={i === index ? "step" : undefined}
                  aria-label={`Painting ${i + 1}: ${it.v.title || it.name}. ${state}`}
                  title={`${it.v.title || it.name} · ${state}`}
                  className={cn("relative block h-[60px] w-[60px] overflow-hidden rounded-[4px] bg-wall ring-offset-2 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-scan", i === index ? "ring-[3px] ring-ink" : "opacity-80 hover:opacity-100")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {thumb(it) && <img src={thumb(it)} alt="" className={cn("h-full w-full object-cover", published(it) && "opacity-70")} />}
                  {(it.upload === "uploading" || it.upload === "waiting") && (
                    <span className="absolute inset-x-0 bottom-0 h-1.5 bg-white/70">
                      {it.source ? <span className={cn("block h-full w-full bg-scan", it.upload === "uploading" ? "animate-pulse" : "opacity-30")} /> : <span className="block h-full bg-scan transition-[width]" style={{ width: `${Math.round(it.progress * 100)}%` }} />}
                    </span>
                  )}
                  {!thumb(it) && it.source && <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-ink-2">{it.source === "drive" ? "Drive" : it.source === "dropbox" ? "Dropbox" : "Sample"}</span>}
                  <Dot it={it} needs={!!m} />
                </button>
              </li>
            );
          })}
          {total < QUEUE_MAX && (
            <li className="shrink-0">
              <button type="button" onClick={() => addRef.current?.click()} className="grid h-[60px] w-[60px] place-items-center rounded-[4px] border-2 border-dashed border-line text-ink-2 hover:border-ink hover:text-ink" aria-label="Add more images">
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            </li>
          )}
        </ol>
        <input ref={addRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; add(fs); }} />
        <input ref={folderRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; add(fs); }} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
          <span className="flex items-center gap-3 text-ink-2" aria-hidden="true">
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-earned" />Done</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-coral" />Needs info</span>
          </span>
          {total < QUEUE_MAX && <button type="button" onClick={() => folderRef.current?.click()} className="inline-flex min-h-[32px] items-center gap-1 font-semibold text-scan hover:underline"><FolderOpen className="h-4 w-4" aria-hidden="true" />Add a folder</button>}
          {total < QUEUE_MAX && <CloudImportButtons onPick={add} mock={mock} max={QUEUE_MAX - total} size="link" />}
          {done.length > 0 && <button type="button" onClick={finishNow} className="inline-flex min-h-[32px] items-center font-semibold text-scan hover:underline">Finish{left.length ? " now" : ""}</button>}
          <Link href="/help/getting-started/upload-several" target="_blank" className="ml-auto text-scan underline-offset-2 hover:underline">How this works</Link>
        </div>
        {notice && <p className="rounded-lg bg-wall px-3 py-2 text-[13px]" role="status">{notice}</p>}
      </section>

      {/* What happened to the painting just published */}
      <div aria-live="polite">
        {bannerItem?.result && <ResultLine r={bannerItem.result} handle={handle} />}
      </div>

      {published(item) ? (
        <div className="af-card grid justify-items-center gap-4 p-5 text-center sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.result!.imageUrl || item.imageUrl} alt={item.v.title} className="max-h-[300px] w-auto rounded-[3px] shadow-[0_10px_30px_rgba(21,22,27,.18)]" />
          <ResultLine r={item.result!} handle={handle} />
          <div className="flex flex-wrap justify-center gap-2">
            {item.result!.slug && <Link href={`/studio/art/${item.result!.slug}`} className="btn btn-ghost btn-sm">Edit it</Link>}
            {left.length > 0 && <button type="button" className="btn btn-blue btn-sm" onClick={() => go(nextOpen(items, index))}>Next to fill in<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>}
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); publish(); }} className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10" noValidate>
          {/* Image */}
          <div className="grid gap-3 lg:sticky lg:top-6">
            <div className="relative grid min-h-[260px] place-items-center overflow-hidden rounded-[4px] bg-gallery p-4 sm:min-h-[360px]">
              {!thumb(item) && item.source && <span className="text-[14px] font-semibold text-ink-2">From {SOURCE_LABEL[item.source]}</span>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {thumb(item) && <img src={thumb(item)} alt={item.v.title || "Your artwork"} className={cn("max-h-[480px] w-auto max-w-full rounded-[2px] shadow-[0_12px_30px_rgba(21,22,27,.22)]", item.upload !== "done" && "opacity-60")} />}
              {(item.upload === "uploading" || item.upload === "waiting") && (
                <span className="absolute inset-x-6 bottom-5 grid gap-1.5 rounded-lg bg-white/90 px-3 py-2 text-left text-[13.5px] font-bold" role="status">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {item.source ? (item.upload === "waiting" ? "Waiting to import" : importingLabel(item.source)) : item.upload === "waiting" ? "Waiting to upload" : `Uploading ${Math.round(item.progress * 100)}%`}
                  </span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-line">
                    {item.source ? <span className={cn("block h-full w-full bg-scan", item.upload === "uploading" ? "animate-pulse" : "opacity-30")} /> : <span className="block h-full bg-scan transition-[width]" style={{ width: `${Math.round(item.progress * 100)}%` }} />}
                  </span>
                </span>
              )}
            </div>
            <p className="truncate text-[12.5px] text-ink-2" title={item.name}>{item.name}</p>
            {item.upload === "error" && (
              <div className="grid gap-2 rounded-xl border-2 border-coral bg-[#fff1ed] p-3 text-[14px]" role="alert">
                <b>{item.uploadError || "Upload failed."}</b>
                <div className="flex flex-wrap gap-2">
                  {(files.current.has(item.id) || remotes.current.has(item.id)) && item.uploadError !== TOO_BIG && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(item.id, { upload: "waiting", progress: 0, uploadError: undefined })}><RotateCcw className="h-4 w-4" aria-hidden="true" />{item.source ? "Retry import" : "Retry upload"}</button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(item.id)}><Trash2 className="h-4 w-4" aria-hidden="true" />Remove</button>
                </div>
              </div>
            )}
            {item.upload === "done" && printable && <PrintSizes imageUrl={item.imageUrl} printable={printable} dims={item.dims} shape={item.dims} />}
          </div>

          {/* Details: the familiar single form */}
          <div className="grid gap-6">
            <DetailsFields v={item.v} set={(p) => setV(p)} />
            <PriceFields
              prices={item.v.prices} ready={ready} split={split} guide={guide} note={sameNote}
              setPrices={(fn) => patch(item.id, (it) => ({ v: { ...it.v, prices: fn(it.v.prices) }, carry: false }))}
            />
            <EditionField
              limited={item.v.limited} edition={item.v.edition} note={sameNote}
              setLimited={(limited) => setV({ limited }, false)} setEdition={(edition) => setV({ edition }, false)}
            />
            <SensitiveField sensitive={item.v.sensitive} setSensitive={(sensitive) => setV({ sensitive }, false)} />
            <OwnershipField owned={owned} setOwned={setOwned} many note="Ticked once for this whole batch. New artists' first few pieces get a quick look before they go live." />

            {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-xl border-2 border-coral bg-[#fff1ed] px-3.5 py-2.5 text-[14px] font-semibold outline-none">{error}</p>}

            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button type="submit" className="btn btn-blue btn-lg" disabled={!!publishing || item.upload === "waiting" || item.upload === "uploading"}>
                  {publishing === item.id && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                  {item.result?.state === "failed" ? "Try again" : left.length > 1 ? "Publish and next" : "Publish"}
                </button>
                {(item.upload === "waiting" || item.upload === "uploading") && <span className="text-[13px] text-ink-2">Publishes once it&apos;s {item.source ? "imported" : "uploaded"}</span>}
                {problem && item.upload === "done" && !error && <span className="text-[13px] font-semibold text-coral">Needs info: {problem}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(index - 1)} disabled={index === 0}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(index + 1)} disabled={index >= total - 1}>Next<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(item.id)} disabled={publishing === item.id}><Trash2 className="h-4 w-4" aria-hidden="true" />Skip and remove</button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

function Dot({ it, needs }: { it: QueueItem; needs: boolean }) {
  const r = it.result?.state;
  if (r === "live" || r === "review") {
    return (
      <span aria-hidden="true" className={cn("absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-white", r === "live" ? "bg-earned text-white" : "bg-sticker text-ink")}>
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    );
  }
  if (needs) {
    return (
      <span aria-hidden="true" className="absolute right-1 top-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-white bg-coral text-white">
        <AlertCircle className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    );
  }
  return null;
}

function ResultLine({ r, handle }: { r: Result; handle: string }) {
  if (r.state === "live") {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-2 border-earned/50 bg-[#effaf4] px-3.5 py-2.5 text-[14px]">
        <Check className="h-4 w-4 text-earned" aria-hidden="true" />
        <b>{r.title} is live.</b>
        {r.notice && <span className="text-ink-2">{r.notice}</span>}
        {r.slug && <Link href={artPath(handle, r.slug)} target="_blank" className="font-semibold text-scan hover:underline">View</Link>}
      </p>
    );
  }
  if (r.state === "review") {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border-2 border-sticker bg-[#fffbe8] px-3.5 py-2.5 text-[14px]">
        <span className="sticker-badge !text-[12px]">In review</span>
        <b>{r.title}</b>
        <span className="text-ink-2">{r.duplicate === "review" ? r.notice : <>We look over every new artist&apos;s first pieces. {REVIEW_NOTE}.</>}</span>
      </p>
    );
  }
  return null;
}

type Collection = { id: string; title: string; artworkIds: string[] };

/** The end of a batch: what's live, what's in review, then codes and collections. */
function Summary({ items, handle, onMore, headingRef }: { items: QueueItem[]; handle: string; onMore: () => void; headingRef: RefObject<HTMLHeadingElement> }) {
  const live = items.filter((i) => i.result?.state === "live");
  const review = items.filter((i) => i.result?.state === "review");
  const ids = items.map((i) => i.result!.id!).filter(Boolean);
  const slugs = live.map((i) => i.result!.slug!).filter(Boolean);

  const [cols, setCols] = useState<Collection[] | null>(null);
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("new");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || cols) return;
    fetch("/api/studio/collections", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { collections: [] }))
      .then((d) => { setCols(d.collections || []); if (d.collections?.length) setPick(d.collections[0].id); })
      .catch(() => setCols([]));
  }, [open, cols]);

  async function addToCollection() {
    setMsg(null);
    if (pick === "new" && !name.trim()) { setMsg({ ok: false, text: "Give the collection a name." }); nameRef.current?.focus(); return; }
    setBusy(true);
    try {
      let col = cols?.find((c) => c.id === pick);
      if (pick === "new") {
        const r = await fetch("/api/studio/collections", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title: name.trim() }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || "Couldn't make the collection.");
        col = d.collection;
      }
      if (!col) throw new Error("Pick a collection.");
      const artworkIds = [...col.artworkIds, ...ids.filter((id) => !col!.artworkIds.includes(id))];
      const r = await fetch(`/api/studio/collections/${col.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ artworkIds }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't add them.");
      setCols((cs) => (cs || []).filter((c) => c.id !== col!.id).concat(d.collection));
      setPick(d.collection.id);
      setName("");
      setMsg({ ok: true, text: `Added ${ids.length} ${ids.length === 1 ? "piece" : "pieces"} to ${d.collection.title}.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message || "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="af-card grid gap-6 p-5 sm:p-8">
      <div className="grid gap-2">
        <h2 ref={headingRef} tabIndex={-1} className="display text-[clamp(32px,4vw,44px)] outline-none">{items.length ? "That's the batch." : "Nothing published."}</h2>
        <p className="text-[15px] text-ink-2">
          {live.length > 0 && <><b className="num text-ink">{live.length}</b> live on your page. </>}
          {review.length > 0 && <><b className="num text-ink">{review.length}</b> in review, usually within a day. We&apos;ll email you as each goes live. </>}
          {live.length > 0 && "One email with the whole list is on its way."}
        </p>
      </div>

      {items.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={it.result?.slug ? `/studio/art/${it.result.slug}` : "/studio/art"} className="group grid content-start gap-1.5 text-[12.5px] text-ink no-underline">
                <span className="relative block aspect-[4/5] overflow-hidden rounded-[3px] bg-gallery">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.result?.imageUrl || it.imageUrl} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                  <span className={cn("absolute left-1.5 top-1.5 rounded-full border-[1.5px] border-ink px-2 py-0.5 text-[11px] font-bold", it.result?.state === "live" ? "bg-white" : "bg-sticker")}>
                    {it.result?.state === "live" ? "Live" : "In review"}
                  </span>
                </span>
                <span className="truncate font-semibold">{it.result?.title || it.v.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {slugs.length > 0 ? (
              <a href={`/api/artworks/qr/bulk?slugs=${slugs.map(encodeURIComponent).join(",")}`} target="_blank" rel="noopener" className="btn btn-blue">Print all their QR codes</a>
            ) : (
              <span className="btn btn-blue pointer-events-none opacity-50" aria-disabled="true">Print all their QR codes</span>
            )}
            <button type="button" className="btn btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>Add them to a collection</button>
          </div>
          {review.length > 0 && <p className="text-[12.5px] text-ink-2">Pieces in review get their codes once they&apos;re live. Find them in <Link href="/studio/qr" className="text-scan hover:underline">QR codes</Link>.</p>}
          {open && (
            <div className="grid gap-3 rounded-xl border-2 border-line bg-white p-3 sm:max-w-[520px]">
              {cols === null ? (
                <p className="flex items-center gap-2 text-[14px] text-ink-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your collections</p>
              ) : (
                <>
                  <label className="af-field">
                    <span className="label">Collection</span>
                    <select value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-[40px] rounded-lg border-2 border-ink bg-white px-2">
                      {cols.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.artworkIds.length})</option>)}
                      <option value="new">New collection…</option>
                    </select>
                  </label>
                  {pick === "new" && (
                    <label className="af-field">
                      <span className="label">Name</span>
                      <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Summer 2026" />
                    </label>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn btn-blue btn-sm" onClick={addToCollection} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Add {ids.length} {ids.length === 1 ? "piece" : "pieces"}</button>
                    <Link href="/studio/collections" className="text-[13px] font-semibold text-scan hover:underline">Manage collections</Link>
                  </div>
                </>
              )}
              {msg && <p role={msg.ok ? "status" : "alert"} className={cn("text-[14px] font-semibold", msg.ok ? "text-earned" : "text-coral")}>{msg.text}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-dashed border-line pt-4">
        <button type="button" className="btn btn-ghost" onClick={onMore}>Upload more</button>
        <Link href="/studio/art" className="btn btn-ghost">Go to My art</Link>
        <Link href={`/@${handle}`} className="btn btn-ghost">View my page</Link>
      </div>
    </div>
  );
}
