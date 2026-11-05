"use client";

import Link from "next/link";
import { errorText, failed, saved as savedToast } from "@/lib/feedback";
import { useMemo, useState } from "react";
import { ROOM_LABEL, ROOM_SIZE_IN, ROOM_TYPES, autoScenes, suggestScenes, type RoomFrame, type RoomSize, type RoomType } from "@/lib/rooms";
import { autoPhotoScenes, photoRooms, photoSceneCount, photoScenesOn, photoSuggest, sceneLabel } from "@/lib/scenes/client";
import { ROOM_TAG_LABEL, type RoomTag } from "@/lib/scenes/types";
import { cn } from "@/lib/utils";
import RoomCarousel from "./RoomCarousel";
import { RoomScene, useImageAspect } from "./RoomScene";

type Art = { slug: string; title: string; imageUrl: string; roomScenes: number[]; sensitive: string[] };
const MAX = 5;
const SIZES: { key: RoomSize; label: string }[] = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
  { key: "xl", label: "XL" },
];
const FRAMES: { key: RoomFrame | null; label: string; hex: string }[] = [
  { key: null, label: "No frame", hex: "transparent" },
  { key: "black", label: "Black", hex: "#1a1b1f" },
  { key: "white", label: "White", hex: "#f7f6f2" },
  { key: "natural", label: "Natural", hex: "#c49a68" },
];
const TYPE_DAB: Record<RoomType, string> = {
  living: "#e8743b",
  kitchen: "#8e9b7c",
  office: "#2b37f0",
  bedroom: "#c7a597",
  dining: "#b8673f",
  hallway: "#5bc0be",
  cafe: "#7b5a3c",
  nook: "#ffd43b",
};
// photo scenes use their own room tags (procedural types stay as they are)
const CHIP_TYPES: string[] = photoScenesOn ? photoRooms : [...ROOM_TYPES];
const chipLabel = (t: string) => (photoScenesOn ? ROOM_TAG_LABEL[t as RoomTag] : ROOM_LABEL[t as RoomType]) ?? t;
const chipDab = (t: string) => TYPE_DAB[t as RoomType] ?? "#5bc0be";

export default function RoomPicker({ art, arts }: { art: Art; arts: { slug: string; title: string; imageUrl: string }[] }) {
  const [picks, setPicks] = useState<number[]>(art.roomScenes.slice(0, MAX));
  const [saved, setSaved] = useState<number[]>(art.roomScenes.slice(0, MAX));
  const [type, setType] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [size, setSize] = useState<RoomSize>("medium");
  const [frame, setFrame] = useState<RoomFrame | null>("black");
  const [focus, setFocus] = useState(0);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error" | "full"; msg?: string }>({ kind: "idle" });
  const aspect = useImageAspect(art.imageUrl);
  const blur = art.sensitive.length > 0;

  const suggestions = useMemo(
    () => (photoScenesOn ? photoSuggest(art.slug, round, type as RoomTag | null, 24) : suggestScenes(art.slug, round, type as RoomType | null, 24)),
    [art.slug, round, type],
  );
  const auto = useMemo(() => (photoScenesOn ? autoPhotoScenes(art.slug) : autoScenes(art.slug)), [art.slug]);
  const dirty = picks.join(",") !== saved.join(",");

  function toggle(n: number) {
    const at = picks.indexOf(n);
    if (at >= 0) {
      const next = picks.filter((p) => p !== n);
      setPicks(next);
      setFocus(Math.max(0, Math.min(focus, next.length - 1)));
      setStatus({ kind: "idle" });
      return;
    }
    if (picks.length >= MAX) {
      setStatus({ kind: "full", msg: "Up to 5. Remove one first." });
      return;
    }
    setPicks([...picks, n]);
    setFocus(picks.length);
    setStatus({ kind: "idle" });
  }

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= picks.length) return;
    const next = picks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setPicks(next);
    setFocus(j);
  }

  async function save(scenes: number[]) {
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/studio/rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: art.slug, scenes }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your rooms. Try again.");
      setSaved(data.roomScenes);
      setPicks(data.roomScenes);
      setStatus({ kind: "saved", msg: data.roomScenes.length ? "Saved. Buyers see these now." : "Back to auto rooms." });
      savedToast(data.roomScenes.length ? "Rooms saved" : "Back to auto rooms", { description: data.roomScenes.length ? "Buyers see these now." : "We pick 5 rooms for you." });
    } catch (e) {
      const msg = errorText(e, "Couldn't save your rooms. Try again.");
      setStatus({ kind: "error", msg });
      failed(msg, { retry: () => save(scenes) });
    }
  }

  const previewScenes = picks.length ? picks : auto;

  return (
    <div className="grid gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-8 lg:pb-0 xl:grid-cols-[minmax(0,1fr)_440px]">
      {/* ---- right column on desktop: preview, picks, size, save ---- */}
      <aside className="grid gap-4 lg:sticky lg:top-6 lg:order-last" aria-label="Your rooms">
        {arts.length > 1 && (
          <nav aria-label="Artwork" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
            {arts.map((a) => (
              <Link
                key={a.slug}
                href={`/studio/rooms?art=${encodeURIComponent(a.slug)}`}
                aria-current={a.slug === art.slug ? "page" : undefined}
                title={a.title}
                className={cn("h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 transition", a.slug === art.slug ? "border-ink" : "border-transparent opacity-70 hover:opacity-100")}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.imageUrl} alt={a.title} className="h-full w-full object-cover" loading="lazy" />
              </Link>
            ))}
          </nav>
        )}

        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="display text-[26px] leading-none">{art.title}</h2>
            <span className="text-[13px] text-ink-2">{picks.length ? "What buyers see" : "Auto, for now"}</span>
          </div>
          <RoomCarousel artwork={{ ...art, roomScenes: picks }} scenes={previewScenes} index={picks.length ? focus : 0} size={size} frame={frame} blur={blur} landscape={aspect > 1.05} />
        </div>

        {/* size + frame: the preview and every tile follow */}
        <div className="grid gap-3 rounded-2xl border border-line bg-white p-3">
          <fieldset className="grid grid-cols-4 gap-1.5">
            <legend className="sr-only">Print size</legend>
            {SIZES.map((s) => {
              const [a, b] = ROOM_SIZE_IN[s.key];
              const on = size === s.key;
              return (
                <label key={s.key} className={cn("grid cursor-pointer justify-items-center rounded-xl border-2 px-1 py-1.5 text-center transition focus-within:ring-2 focus-within:ring-scan", on ? "border-ink bg-wall" : "border-line hover:border-ink/40")}>
                  <input type="radio" name="room-size" className="sr-only" checked={on} onChange={() => setSize(s.key)} />
                  <span className="text-[13px] font-bold leading-tight">{s.label}</span>
                  <span className="num text-[12px] text-ink-2">{a}×{b}</span>
                </label>
              );
            })}
          </fieldset>
          <fieldset className="flex flex-wrap gap-1.5">
            <legend className="sr-only">Frame</legend>
            {FRAMES.map((fr) => {
              const on = frame === fr.key;
              return (
                <label key={fr.label} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border-2 py-1 pl-1.5 pr-2.5 text-[13px] font-semibold transition focus-within:ring-2 focus-within:ring-scan", on ? "border-ink" : "border-line hover:border-ink/40")}>
                  <input type="radio" name="room-frame" className="sr-only" checked={on} onChange={() => setFrame(fr.key)} />
                  <span className={cn("h-5 w-5 rounded-full border border-ink/25", !fr.key && "bg-[linear-gradient(135deg,transparent_45%,#d4d0c8_45%,#d4d0c8_55%,transparent_55%)]")} style={fr.key ? { background: fr.hex } : undefined} aria-hidden />
                  {fr.label}
                </label>
              );
            })}
          </fieldset>
        </div>

        {/* the picks, in order */}
        <section aria-labelledby="picks-h" className="grid gap-2">
          <div className="flex items-baseline justify-between">
            <h3 id="picks-h" className="flex items-center gap-2 text-[15px] font-bold">
              <span className="paint-dab" style={{ ["--dab" as string]: "#2b37f0" }} aria-hidden />
              Your rooms <span className="num font-normal text-ink-2">{picks.length}/{MAX}</span>
            </h3>
            {picks.length > 0 && (
              <button type="button" className="text-[13px] font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline" onClick={() => (setPicks([]), setStatus({ kind: "idle" }))}>
                Clear
              </button>
            )}
          </div>
          <ol className="grid grid-cols-5 gap-1.5">
            {Array.from({ length: MAX }, (_, i) => {
              const n = picks[i];
              if (n == null)
                return (
                  <li key={`e${i}`} className="grid aspect-[5/4] place-items-center rounded-lg border-2 border-dashed border-line text-[18px] text-ink-2/60" aria-label={`Slot ${i + 1}, empty`}>
                    {i + 1}
                  </li>
                );
              return (
                <li key={n} className="group relative">
                  <button type="button" onClick={() => setFocus(i)} className={cn("block w-full overflow-hidden rounded-lg border-2 transition", focus === i ? "border-ink" : "border-transparent")} aria-label={`Show ${sceneLabel(n)}`}>
                    <RoomScene scene={n} slug={art.slug} sizes="96px" imageUrl={art.imageUrl} aspect={aspect} size={size} frame={frame} blur={blur} />
                  </button>
                  <span className="pointer-events-none absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-sticker text-[11px] font-bold text-ink shadow-[0_0_0_1.5px_#15161b]">{i + 1}</span>
                  <div className="mt-1 flex justify-between">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move room ${i + 1} earlier`} className="grid h-7 w-7 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink disabled:opacity-25">
                      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                    <button type="button" onClick={() => toggle(n)} aria-label={`Remove room ${i + 1}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-coral">
                      <svg viewBox="0 0 20 20" width="13" height="13" aria-hidden><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === picks.length - 1} aria-label={`Move room ${i + 1} later`} className="grid h-7 w-7 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink disabled:opacity-25">
                      <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* save: inline on desktop, a sticky bar on phones */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mx-auto flex max-w-[640px] items-center gap-2 lg:max-w-none">
            <button type="button" className="btn btn-blue flex-1" disabled={!dirty || picks.length === 0 || status.kind === "saving"} onClick={() => save(picks)}>
              {status.kind === "saving" ? "Saving" : !picks.length ? "Pick a room" : !dirty ? "Saved" : `Save ${picks.length} room${picks.length > 1 ? "s" : ""}`}
            </button>
            {saved.length > 0 && (
              <button type="button" className="btn btn-ghost" onClick={() => save([])} disabled={status.kind === "saving"}>
                Use auto
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className={cn("mx-auto mt-1.5 min-h-[18px] max-w-[640px] text-[13px] lg:max-w-none", status.kind === "error" || status.kind === "full" ? "text-coral" : "text-ink-2")}>
            {status.msg || (dirty ? "Not saved yet." : saved.length ? "Saved." : "Empty means we pick 5 for you.")}
          </p>
        </div>
      </aside>

      {/* ---- the 1,000 rooms ---- */}
      <section aria-labelledby="suggest-h" className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="suggest-h" className="display text-[28px] leading-none">
            Pick your rooms
          </h2>
          <button type="button" className="btn btn-sticker btn-sm" onClick={() => setRound((r) => r + 1)}>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="mr-1">
              <path d="M3 6h3.5l7 8H17M3 14h3.5l2-2.3M13.5 6H17M15 4l2 2-2 2M15 12l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Shuffle
          </button>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Room type">
          {[null, ...CHIP_TYPES].map((t) => {
            const on = type === t;
            return (
              <button
                key={t || "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setType(t)}
                className={cn("flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[14px] font-semibold transition", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink/40")}
              >
                {t && <span className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: chipDab(t) }} aria-hidden />}
                {t ? chipLabel(t) : "All rooms"}
              </button>
            );
          })}
        </div>

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
          {suggestions.map((n) => {
            const at = picks.indexOf(n);
            const on = at >= 0;
            const label = sceneLabel(n);
            return (
              <li key={n}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(n)}
                  className={cn(
                    "group relative block w-full overflow-hidden rounded-xl text-left transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scan",
                    on ? "shadow-[0_0_0_3px_#15161b]" : "shadow-[0_0_0_1px_rgba(21,22,27,.1)] hover:shadow-[0_0_0_2px_rgba(21,22,27,.45)]",
                  )}
                >
                  <RoomScene
                    scene={n}
                    slug={art.slug}
                    sizes="(min-width: 1280px) 22vw, (min-width: 640px) 33vw, 50vw"
                    imageUrl={art.imageUrl}
                    aspect={aspect}
                    size={size}
                    frame={frame}
                    blur={blur}
                    className="transition duration-300 group-hover:scale-[1.02]"
                  />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent truncate px-2 pb-1.5 pt-5 text-[12px] font-semibold text-white">{label}</span>
                  {on ? (
                    <span className="sticker-badge absolute right-1.5 top-1.5 !px-2 !py-0.5 !text-[12px]">{at + 1}</span>
                  ) : (
                    <span className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-white/90 text-[18px] font-bold leading-none text-ink opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden>
                      +
                    </span>
                  )}
                  <span className="sr-only">{on ? `Picked, number ${at + 1}` : "Pick"}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-center text-[13px] text-ink-2">
          {photoScenesOn ? `${photoSceneCount.toLocaleString("en-US")} photo scenes.` : "1,000 rooms."}{" "}
          <button type="button" className="font-semibold text-scan underline-offset-2 hover:underline" onClick={() => setRound((r) => r + 1)}>
            Shuffle for more
          </button>
        </p>
      </section>
    </div>
  );
}
