"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ROOM_SIZE_IN, printBox, type RoomFrame, type RoomSize } from "@/lib/rooms";
import { photoScene, sceneLabel, scenesForArt } from "@/lib/scenes/client";
import { cn } from "@/lib/utils";
import { RoomScene, useImageAspect } from "./RoomScene";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type RoomCarouselProps = {
  artwork: { slug: string; imageUrl: string; title: string; roomScenes?: number[] | null };
  size: RoomSize;
  /** Frame color, or null/undefined for an unframed print. */
  frame?: RoomFrame | null;
  /** White mat inside the frame (default on). */
  mat?: boolean;
  /** Skip measuring the image: true for landscape, false for portrait. */
  landscape?: boolean;
  /** Blur the art (sensitive work the viewer hasn't opted into). */
  blur?: boolean;
  /** Override the scenes (the picker's live preview). */
  scenes?: number[];
  /** Start on this slide instead of a random one. Changing it jumps there. */
  index?: number;
  className?: string;
};

/**
 * Room previews for the buy page: the artist's picks (or five auto-picked rooms),
 * starting on a random one each visit. Swipe, arrows, dots. SVG only; offscreen slides stay empty.
 */
export default function RoomCarousel({ artwork, size, frame, mat = true, landscape, blur, scenes: override, index, className }: RoomCarouselProps) {
  const scenes = useMemo(() => (override && override.length ? override : scenesForArt(artwork)), [override, artwork]);
  const aspect = useImageAspect(artwork.imageUrl, landscape === undefined ? null : landscape ? 1.4 : 0.75);
  const track = useRef<HTMLDivElement>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = "rc" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [cur, setCur] = useState(0);
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const key = scenes.join(",");

  const jump = useCallback((i: number, smooth: boolean) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // first paint in the browser: pick the opening look ("every time you open a print it's a different look")
  useIso(() => {
    const start = index != null ? Math.min(Math.max(0, index), scenes.length - 1) : Math.floor(Math.random() * scenes.length);
    setCur(start);
    setSeen(new Set([start]));
    jump(start, false);
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (index == null || !ready) return;
    const i = Math.min(Math.max(0, index), scenes.length - 1);
    jump(i, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // keep the slide in place when the width changes (rotation, resize)
  useEffect(() => {
    const onResize = () => jump(cur, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [cur, jump]);

  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = track.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i !== cur && i >= 0 && i < scenes.length) setCur(i);
      // render neighbours as they come into view
      const lo = Math.floor(el.scrollLeft / el.clientWidth);
      setSeen((s) => (s.has(lo) && s.has(lo + 1) ? s : new Set([...s, lo, Math.min(lo + 1, scenes.length - 1)])));
    });
  };

  const go = (d: number) => {
    const n = scenes.length;
    const i = (cur + d + n) % n;
    setSeen((s) => new Set([...s, i]));
    jump(i, Math.abs(d) === 1 && !(cur === n - 1 && d === 1) && !(cur === 0 && d === -1));
    setCur(i);
  };

  // after settling, warm the next and previous slides
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const n = scenes.length;
      setSeen((s) => (s.has((cur + 1) % n) && s.has((cur - 1 + n) % n) ? s : new Set([...s, (cur + 1) % n, (cur - 1 + n) % n])));
    }, 350);
    return () => clearTimeout(t);
  }, [cur, ready, scenes.length]);

  const box = printBox(size, aspect, frame, mat);
  const [a, b] = ROOM_SIZE_IN[size];
  const dims = box.land ? `${b} × ${a} in` : `${a} × ${b} in`;
  const label = sceneLabel(scenes[cur] ?? scenes[0]);
  const photo = photoScene(scenes[cur] ?? scenes[0]);

  return (
    <figure
      className={cn("group relative select-none overflow-hidden rounded-2xl bg-wall", className)}
      aria-roledescription="carousel"
      aria-label={`${artwork.title} in a room, ${dims}${frame ? `, ${frame} frame` : ""}`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") (e.preventDefault(), go(1));
        if (e.key === "ArrowLeft") (e.preventDefault(), go(-1));
      }}
    >
      <div
        ref={track}
        onScroll={onScroll}
        role="region"
        aria-label={`Rooms for ${artwork.title}`}
        tabIndex={0}
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] focus-visible:ring-2 focus-visible:ring-scan [&::-webkit-scrollbar]:hidden"
      >
        {scenes.map((n, i) => (
          <div
            key={`${n}-${i}`}
            className="aspect-[5/4] w-full shrink-0 snap-center snap-always"
            id={`${uid}-p${i}`}
            role="tabpanel"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${scenes.length}: ${sceneLabel(n)}`}
            aria-hidden={i !== cur}
          >
            {ready && seen.has(i) ? (
              <RoomScene
                scene={n}
                slug={artwork.slug}
                eager={i === cur}
                sizes="(min-width: 1024px) 560px, (min-width: 768px) 50vw, 100vw"
                imageUrl={artwork.imageUrl}
                aspect={aspect}
                size={size}
                frame={frame}
                mat={mat}
                blur={blur}
                className={cn("transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(ellipse_at_50%_30%,#f7f5f0,#e7e3db)]" />
            )}
          </div>
        ))}
      </div>

      {/* caption: room + true size */}
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2.5 sm:p-3">
        <span className="rounded-full bg-white/90 px-2.5 py-1 text-[12px] font-semibold text-ink shadow-[0_1px_3px_rgba(21,22,27,.18)] backdrop-blur sm:text-[13px]" aria-live="polite">
          {label}
        </span>
        <span className="num rounded-full bg-ink/80 px-2.5 py-1 text-[12px] font-semibold text-white sm:text-[13px]">
          {dims}
          {frame ? " · framed" : ""}
        </span>
      </figcaption>
      {photo?.credit && (
        <p className="absolute bottom-11 left-2.5 max-w-[70%] truncate rounded-full bg-white/95 px-2 py-0.5 text-[12px] leading-tight text-ink-2 shadow-[0_1px_3px_rgba(21,22,27,.18)] sm:left-3">
          {photo.url ? (
            <a href={photo.url} target="_blank" rel="noopener noreferrer" className="underline decoration-ink-2/40 underline-offset-2 hover:text-ink">
              {photo.credit}
            </a>
          ) : (
            photo.credit
          )}
        </p>
      )}

      {scenes.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous room"
            className="absolute left-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-[0_2px_8px_rgba(21,22,27,.2)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next room"
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-ink shadow-[0_2px_8px_rgba(21,22,27,.2)] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div
            className="absolute inset-x-0 top-2.5 flex justify-center gap-1.5"
            role="tablist"
            aria-label="Rooms"
            onKeyDown={(e) => {
              const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
              if (!k) return;
              e.preventDefault();
              e.stopPropagation();
              const i = (cur + k + scenes.length) % scenes.length;
              go(k);
              dots.current[i]?.focus();
            }}
          >
            {scenes.map((n, i) => (
              <button
                key={`d${n}-${i}`}
                ref={(el) => {
                  dots.current[i] = el;
                }}
                type="button"
                role="tab"
                aria-selected={i === cur}
                aria-controls={`${uid}-p${i}`}
                tabIndex={i === cur ? 0 : -1}
                aria-label={`Room ${i + 1}: ${sceneLabel(n)}`}
                onClick={() => go(i - cur)}
                className="grid h-6 w-6 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-scan"
              >
                <span className={cn("block h-1.5 rounded-full shadow-[0_0_0_1px_rgba(21,22,27,.15)] transition-all", i === cur ? "w-4 bg-white" : "w-1.5 bg-white/60")} />
              </button>
            ))}
          </div>
        </>
      )}
    </figure>
  );
}
