"use client";

import { DragEvent, FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { collectionPath } from "@/lib/urls";
import { errorText, failed, saved as savedToast, undoable, withUndo } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ExternalLink, GripVertical, Plus, Star, Trash2, X } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import type { StudioCollection } from "@/components/collections/server";

type Art = { id: string; slug: string; title: string; imageUrl: string; live: boolean };

const move = <T,>(list: T[], from: number, to: number) => {
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, it);
  return next;
};

async function api(url: string, method: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  } catch (e) {
    throw new Error(errorText(e, "Didn't save. Try again."));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Didn't save. Try again.");
  return data;
}

export default function CollectionsManager({ artistSlug, initial, arts }: { artistSlug: string; initial: StudioCollection[]; arts: Art[] }) {
  const [cols, setCols] = useState(initial);
  const [activeId, setActiveId] = useState<string | null>(initial[0]?.id ?? null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(0);
  // Last save result, shown next to "Saving…": the quiet confirmation for drag-and-drop and auto-saves.
  const [lastSave, setLastSave] = useState<"saved" | "failed" | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [nameHint, setNameHint] = useState(false);
  const [picking, setPicking] = useState(initial.length > 0 && initial[0].artworkIds.length === 0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const editorRef = useRef<HTMLDivElement>(null);
  const artById = useMemo(() => new Map(arts.map((a) => [a.id, a])), [arts]);
  const active = cols.find((c) => c.id === activeId) ?? null;

  /** Run saves one after another, so a slow request can't overwrite a newer one. */
  const save = (fn: () => Promise<unknown>) => {
    setSaving((n) => n + 1);
    queue.current = queue.current
      .then(fn)
      .then(() => setLastSave("saved"))
      .catch((e: Error) => {
        setLastSave("failed");
        // The screen already shows the change; a refresh brings back what's really saved.
        failed(e.message, { fix: { label: "Refresh", href: "/studio/collections" } });
      })
      .finally(() => setSaving((n) => n - 1));
  };

  const update = (id: string, patch: Partial<StudioCollection>, body: Record<string, unknown>) => {
    setCols((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    save(() => api(`/api/studio/collections/${id}`, "PATCH", body).then((d) => setCols((cs) => cs.map((c) => (c.id === id ? { ...c, coverArtworkId: d.collection.coverArtworkId } : c)))));
  };

  const setWorks = (c: StudioCollection, artworkIds: string[]) => {
    const coverGone = c.coverArtworkId && !artworkIds.includes(c.coverArtworkId);
    const coverArtworkId = !c.coverArtworkId || coverGone ? artworkIds[0] ?? null : c.coverArtworkId;
    update(c.id, { artworkIds, coverArtworkId }, { artworkIds, ...(coverArtworkId !== c.coverArtworkId ? { coverArtworkId } : {}) });
  };

  const reorderCollections = (next: StudioCollection[]) => {
    setCols(next);
    save(() => api("/api/studio/collections/order", "POST", { ids: next.map((c) => c.id) }));
  };

  async function create(e: FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (creating) return;
    if (!title) { setNameHint(true); titleRef.current?.focus(); return; }
    setNameHint(false);
    setCreating(true);
    try {
      const { collection } = await api("/api/studio/collections", "POST", { title });
      setCols((cs) => [...cs, collection]);
      setActiveId(collection.id);
      setNewTitle("");
      setPicking(true);
      savedToast(`Made ${collection.title}`, { description: "Now tap pieces to add them." });
      setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (err) {
      failed(errorText(err, "Couldn't make the collection. Try again."), { retry: () => titleRef.current?.form?.requestSubmit() });
    } finally {
      setCreating(false);
    }
  }

  /** Gone right away with Undo for 6 seconds; the delete is sent after that (or when the page closes). */
  async function remove(c: StudioCollection) {
    const at = cols.findIndex((x) => x.id === c.id);
    const rest = cols.filter((x) => x.id !== c.id);
    undoable(`Deleted ${c.title}`, {
      description: "The art stays on your page.",
      hide: () => {
        setCols((cs) => cs.filter((x) => x.id !== c.id));
        setActiveId(rest[0]?.id ?? null);
      },
      restore: () => {
        setCols((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs.slice(0, at), c, ...cs.slice(at)]));
        setActiveId(c.id);
      },
      commit: async () => {
        const res = await fetch(`/api/studio/collections/${c.id}`, { method: "DELETE", credentials: "include", keepalive: true });
        if (!res.ok && res.status !== 404) throw new Error((await res.json().catch(() => ({}))).error || "Didn't delete. Try again.");
      },
      failMessage: "Collection not deleted",
    });
  }

  /** Take a piece out (saved right away), with Undo to put it back in the same spot. */
  const takeOut = (c: StudioCollection, id: string, title: string) => {
    const before = c.artworkIds;
    const cover = c.coverArtworkId;
    setWorks(c, before.filter((x) => x !== id));
    withUndo(`Took ${title} out`, () => update(c.id, { artworkIds: before, coverArtworkId: cover }, { artworkIds: before, coverArtworkId: cover }));
  };

  const pick = (id: string) => {
    setActiveId(id);
    const c = cols.find((x) => x.id === id);
    setPicking(!!c && c.artworkIds.length === 0);
    if (window.matchMedia("(max-width: 1023px)").matches) setTimeout(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // HTML5 drag and drop (mouse); the arrow buttons do the same on touch and keyboard.
  const drag = useRef<{ kind: "col" | "work"; from: number } | null>(null);
  const [over, setOver] = useState<{ kind: "col" | "work"; i: number } | null>(null);
  const dragProps = (kind: "col" | "work", i: number, onDrop: (from: number, to: number) => void) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => { drag.current = { kind, from: i }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(i)); },
    onDragOver: (e: DragEvent) => { if (drag.current?.kind !== kind) return; e.preventDefault(); if (over?.i !== i || over.kind !== kind) setOver({ kind, i }); },
    onDragLeave: () => setOver((o) => (o?.kind === kind && o.i === i ? null : o)),
    onDrop: (e: DragEvent) => { e.preventDefault(); const d = drag.current; drag.current = null; setOver(null); if (d && d.kind === kind && d.from !== i) onDrop(d.from, i); },
    onDragEnd: () => { drag.current = null; setOver(null); },
  });

  const coverOf = (c: StudioCollection) => artById.get(c.coverArtworkId ?? "") ?? artById.get(c.artworkIds[0] ?? "");

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-10">
      {/* Collections list */}
      <aside className="grid gap-3 lg:sticky lg:top-6" aria-label="Your collections">
        <form onSubmit={create} className="flex gap-2">
          <label className="af-field flex-1 py-2">
            <span className="label">New collection</span>
            <input ref={titleRef} id="new-collection" value={newTitle} onChange={(e) => { setNewTitle(e.target.value); if (nameHint) setNameHint(false); }} maxLength={80} placeholder="East River series" aria-describedby={nameHint ? "new-collection-hint" : undefined} />
          </label>
          <button type="submit" className="btn btn-blue shrink-0 self-stretch px-4" disabled={creating} aria-label="Add collection">
            <Plus className="h-5 w-5" aria-hidden /><span className="hidden sm:inline">Add</span>
          </button>
        </form>
        {nameHint && <p id="new-collection-hint" role="alert" className="-mt-1 text-[13px] font-semibold text-coral">Type a name first, like &ldquo;East River series&rdquo;.</p>}

        {/* No collections yet: the editor side says what they are and how to start, so this list stays quiet. */}
        {cols.length === 0 ? null : (
          <ol className="grid gap-2">
            {cols.map((c, i) => {
              const cover = coverOf(c);
              const on = c.id === activeId;
              return (
                <li
                  key={c.id}
                  {...dragProps("col", i, (from, to) => reorderCollections(move(cols, from, to)))}
                  className={cn(
                    "group flex items-center gap-2 rounded-xl border-2 bg-white p-1.5 pr-1 transition",
                    on ? "border-ink shadow-[3px_3px_0_var(--af-ink)]" : "border-line hover:border-ink-2",
                    over?.kind === "col" && over.i === i && "border-scan bg-scan-soft",
                  )}
                >
                  <GripVertical className="hidden h-4 w-4 shrink-0 cursor-grab text-ink-2 sm:block" aria-hidden />
                  <button type="button" onClick={() => pick(c.id)} aria-current={on ? "true" : undefined} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan">
                    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-gallery p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {cover ? <img src={cover.imageUrl} alt="" className="max-h-full max-w-full bg-white object-contain" /> : <i className="paint-dab h-5 w-5" style={{ ["--dab" as string]: "var(--af-sticker)" }} />}
                    </span>
                    <span className="min-w-0 leading-tight">
                      <b className="block truncate text-[15px]">{c.title}</b>
                      <span className="num text-[12.5px] text-ink-2">{c.artworkIds.length} {c.artworkIds.length === 1 ? "piece" : "pieces"}</span>
                    </span>
                  </button>
                  <span className="flex shrink-0 flex-col">
                    <button type="button" onClick={() => reorderCollections(move(cols, i, i - 1))} disabled={i === 0} className="grid h-7 w-9 place-items-center rounded text-ink-2 hover:bg-wall hover:text-ink disabled:opacity-25" aria-label={`Move ${c.title} up`}>
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button type="button" onClick={() => reorderCollections(move(cols, i, i + 1))} disabled={i === cols.length - 1} className="grid h-7 w-9 place-items-center rounded text-ink-2 hover:bg-wall hover:text-ink disabled:opacity-25" aria-label={`Move ${c.title} down`}>
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-[12.5px] text-ink-2" aria-live="polite">
          {saving ? "Saving…" : lastSave === "saved" ? "All changes saved. " : lastSave === "failed" ? "Last change didn't save. " : ""}
          {!saving && cols.length > 1 ? "Drag or use the arrows to sort." : ""}
        </p>
      </aside>

      {/* Editor */}
      <div ref={editorRef} className="min-w-0 scroll-mt-4">
        {!active ? (
          <EmptyState
            className="lg:min-h-[320px] lg:content-center"
            dab="#c98a5a"
            title={cols.length ? "Pick a collection to edit" : "No collections yet"}
            body="Hang a few together: a series, a place, a season. Name a collection above, tap pieces to add them and sort them. Each one gets its own page buyers can browse."
            action={{ label: cols.length ? "Make another" : "Name your first", onClick: () => titleRef.current?.focus() }}
            help={{ label: "How collections work", href: "/help/selling/collections" }}
          />
        ) : (
          <section key={active.id} aria-label={`Edit ${active.title}`} className="grid gap-5">
            <div className="grid gap-3 rounded-2xl border-[1.5px] border-ink bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="af-field min-w-0 flex-1 basis-[240px]">
                  <span className="label">Name</span>
                  <input
                    defaultValue={active.title}
                    maxLength={80}
                    className="font-display !text-[26px] font-bold [font-variation-settings:'wdth'_80]"
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    onBlur={(e) => {
                      const t = e.target.value.replace(/\s+/g, " ").trim();
                      if (!t) { e.target.value = active.title; return; }
                      if (t !== active.title) update(active.id, { title: t }, { title: t });
                    }}
                  />
                </label>
                <div className="flex gap-2 sm:pt-2">
                  <Link href={collectionPath(artistSlug, active.slug)} target="_blank" className="btn btn-ghost btn-sm">
                    <ExternalLink className="h-4 w-4" aria-hidden />View
                  </Link>
                  <button type="button" onClick={() => remove(active)} className="btn btn-ghost btn-sm text-coral" aria-label={`Delete ${active.title}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <label className="af-field">
                <span className="label">A line about it <span className="text-ink-2">(optional)</span></span>
                <textarea
                  defaultValue={active.description}
                  rows={2}
                  maxLength={600}
                  placeholder="Painted on walks up the parkway, spring 2026."
                  className="resize-y"
                  onBlur={(e) => { const d = e.target.value.trim(); if (d !== active.description) update(active.id, { description: d }, { description: d }); }}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-baseline gap-2 text-[20px] font-bold">
                <i className="paint-dab" style={{ ["--dab" as string]: "var(--af-scan)" }} />On the wall
                <span className="num text-[14px] font-semibold text-ink-2">{active.artworkIds.length}</span>
              </h2>
              <button type="button" onClick={() => setPicking((p) => !p)} aria-expanded={picking} className={cn("btn btn-sm", picking ? "btn-ghost" : "btn-blue")}>
                {picking ? "Done adding" : <><Plus className="h-4 w-4" aria-hidden />Add pieces</>}
              </button>
            </div>

            {picking && (
              <div className="grid gap-2 rounded-2xl bg-wall p-3 sm:p-4">
                <p className="text-[13.5px] font-semibold">Tap to add or take out.</p>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-7">
                  {arts.map((a) => {
                    const inIt = active.artworkIds.includes(a.id);
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          aria-pressed={inIt}
                          onClick={() => setWorks(active, inIt ? active.artworkIds.filter((x) => x !== a.id) : [...active.artworkIds, a.id])}
                          className={cn("relative grid w-full gap-1 rounded-lg p-1 text-left transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan", inIt ? "bg-ink text-white" : "bg-white hover:bg-paper")}
                        >
                          <span className="grid aspect-square place-items-center overflow-hidden rounded-md bg-gallery p-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={a.imageUrl} alt="" className="max-h-full max-w-full bg-white object-contain" />
                          </span>
                          <span className="truncate px-0.5 text-[12px] font-semibold">{a.title}</span>
                          <span className={cn("absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 text-[12px] font-bold", inIt ? "border-white bg-sticker text-ink" : "border-ink/30 bg-white/90")}>
                            {inIt ? active.artworkIds.indexOf(a.id) + 1 : <Plus className="h-3.5 w-3.5" aria-hidden />}
                          </span>
                          {!a.live && <span className="sr-only">(in review)</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {active.artworkIds.length === 0 ? (
              !picking && (
                <EmptyState
                  compact
                  title="Nothing in this collection yet"
                  body="Add pieces and sort them. The first one is the cover."
                  action={{ label: "Add pieces", onClick: () => setPicking(true) }}
                />
              )
            ) : (
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {active.artworkIds.map((id, i) => {
                  const a = artById.get(id);
                  if (!a) return null;
                  const isCover = (active.coverArtworkId ?? active.artworkIds[0]) === id;
                  const n = active.artworkIds.length;
                  return (
                    <li
                      key={id}
                      {...dragProps("work", i, (from, to) => setWorks(active, move(active.artworkIds, from, to)))}
                      className={cn("group relative grid cursor-grab gap-2 rounded-xl border-2 bg-white p-2 transition active:cursor-grabbing", over?.kind === "work" && over.i === i ? "border-scan bg-scan-soft" : "border-transparent hover:border-line")}
                    >
                      <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-lg bg-gallery bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#e9e6df_75%)] p-[12%]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.imageUrl} alt={a.title} draggable={false} className="max-h-full max-w-full bg-white object-contain shadow-[0_10px_20px_-8px_rgba(21,22,27,.45)]" />
                        <span className="num absolute left-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white text-[13px] font-bold shadow-sm">{i + 1}</span>
                        {isCover && <span className="sticker-badge absolute bottom-2 left-2 text-[11.5px]">Cover</span>}
                        <button type="button" onClick={() => takeOut(active, id, a.title)} className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink-2 shadow-sm hover:text-coral" aria-label={`Take ${a.title} out`}>
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <b className="truncate px-0.5 text-[13.5px]">{a.title}{!a.live && <span className="ml-1 font-normal text-ink-2">· in review</span>}</b>
                      <div className="flex items-center justify-between gap-1">
                        <span className="flex">
                          <button type="button" onClick={() => setWorks(active, move(active.artworkIds, i, i - 1))} disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-full hover:bg-wall disabled:opacity-25" aria-label={`Move ${a.title} earlier`}>
                            <ChevronLeft className="h-4 w-4" aria-hidden />
                          </button>
                          <button type="button" onClick={() => setWorks(active, move(active.artworkIds, i, i + 1))} disabled={i === n - 1} className="grid h-9 w-9 place-items-center rounded-full hover:bg-wall disabled:opacity-25" aria-label={`Move ${a.title} later`}>
                            <ChevronRight className="h-4 w-4" aria-hidden />
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => update(active.id, { coverArtworkId: id }, { coverArtworkId: id })}
                          aria-pressed={isCover}
                          className={cn("flex h-9 items-center gap-1 rounded-full px-2.5 text-[12.5px] font-semibold", isCover ? "text-ink" : "text-ink-2 hover:bg-wall hover:text-ink")}
                          aria-label={isCover ? `${a.title} is the cover` : `Make ${a.title} the cover`}
                        >
                          <Star className={cn("h-4 w-4", isCover && "fill-sticker text-ink")} aria-hidden />{isCover ? "Cover" : <span className="hidden sm:inline">Cover</span>}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="relative w-fit text-[13px] text-ink-2">
              Drag to sort, or use the arrows. Saves as you go.
              <BrushStroke className="absolute -bottom-1.5 left-0 h-1.5 w-24 opacity-70" />
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
