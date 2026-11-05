"use client";

import { KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ROOM_SIZE_IN, type RoomFrame, type RoomSize } from "@/lib/rooms";
import { photoScenesOn, photoSrc } from "@/lib/scenes/client";
import { RoomScene } from "@/components/rooms/RoomScene";
import ArtZoom from "@/components/art/ArtZoom";
import { useSensitivePref } from "@/components/site/useSensitivePref";
import { cn } from "@/lib/utils";
import type { Detail, GalleryRoom } from "@/lib/artGallery";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;
const canOptimize = (src: string) => src.startsWith("/") || src.includes("res.cloudinary.com");
/** The image at a given width through Next's optimizer (same origin), or as-is when it can't be optimized. */
const sized = (src: string, w: number) => (canOptimize(src) ? `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75` : src);

/** A 3× crop in the 5:4 frame, as fractions of an image of this aspect (mirrors lib/artGallery.ts). */
function crop(d: Detail, aspect: number) {
  let w = 1 / 3;
  let h = (w * aspect) / 1.25;
  if (h > 0.6) {
    h = 0.6;
    w = (h * 1.25) / aspect;
  }
  const x = Math.max(0, Math.min(1 - w, d.cx - w / 2));
  const y = Math.max(0, Math.min(1 - h, d.cy - h / 2));
  return { x, y, w, h };
}

type Slide = { kind: "art" } | { kind: "room"; room: GalleryRoom } | { kind: "detail"; d: Detail; i: number };

export type GalleryRequest = { slide: "room"; t: number } | null;

/**
 * The buy page's pictures: the painting, the print in 3–4 rooms at the chosen size and frame, and two close-ups.
 * Swipe or scroll the stage; thumbnails (dots on phones) are a tablist with arrow keys. Zoom opens the full painting.
 */
export default function ArtGallery({
  slug,
  title,
  artistName,
  imageUrl,
  sensitive,
  rooms,
  details,
  aspect,
  size,
  frame,
  onAspect,
  request,
}: {
  slug: string;
  title: string;
  artistName: string;
  imageUrl: string;
  sensitive: string[];
  rooms: GalleryRoom[];
  details: Detail[];
  /** Image width / height (known from the server, or measured here). */
  aspect: number;
  size: RoomSize;
  frame: RoomFrame | null;
  onAspect?: (aspect: number) => void;
  /** Jump to a slide from outside (the size hint's "see it in a room"). */
  request?: GalleryRequest;
}) {
  const [pref] = useSensitivePref();
  const [revealed, setRevealed] = useState(false);
  const blurred = sensitive.length > 0 && !pref && !revealed;
  const slides: Slide[] = [{ kind: "art" }, ...rooms.map((room) => ({ kind: "room" as const, room })), ...(blurred ? [] : details.map((d, i) => ({ kind: "detail" as const, d, i })))];
  const n = slides.length;

  const track = useRef<HTMLDivElement>(null);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [cur, setCur] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [idle, setIdle] = useState(false); // thumbnails of drawn rooms wait until the page has settled
  const [zoom, setZoom] = useState(false);
  const alt = `${title} by ${artistName}`;

  const jump = useCallback((i: number, smooth: boolean) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
  }, []);

  const go = useCallback(
    (i: number, opts: { focusTab?: boolean; smooth?: boolean } = {}) => {
      const k = ((i % n) + n) % n;
      setCur(k);
      setSeen((s) => (s.has(k) ? s : new Set([...s, k])));
      jump(k, opts.smooth ?? true);
      if (opts.focusTab) tabs.current[k]?.focus();
    },
    [n, jump],
  );

  // only the current slide is reachable by keyboard and screen readers; the others are inert until shown
  useIso(() => {
    panels.current.forEach((p, i) => {
      if (p) (p as HTMLDivElement & { inert: boolean }).inert = i !== cur;
    });
  }, [cur, n]);

  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setIdle(true), { timeout: 2500 });
    else setTimeout(() => setIdle(true), 1200);
  }, []);

  // keep the slide in place when the width changes; fewer slides (a reveal or blur change) clamps it
  useEffect(() => {
    const onResize = () => jump(cur, false);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [cur, jump]);
  useEffect(() => {
    if (cur >= n) go(n - 1, { smooth: false });
  }, [cur, n, go]);

  useEffect(() => {
    if (request?.slide === "room" && rooms.length) go(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.t]);

  const raf = useRef(0);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = track.current;
      if (!el || !el.clientWidth) return;
      const i = Math.round(el.scrollLeft / el.clientWidth);
      if (i >= 0 && i < n && i !== cur) setCur(i);
      const lo = Math.floor(el.scrollLeft / el.clientWidth);
      setSeen((s) => (s.has(lo) && s.has(Math.min(lo + 1, n - 1)) ? s : new Set([...s, lo, Math.min(lo + 1, n - 1)])));
    });
  };

  const onTabKey = (e: KeyboardEvent) => {
    const k = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: n - 1 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    go(k, { focusTab: true });
  };
  const onStageKey = (e: KeyboardEvent) => {
    if (e.target !== panels.current[cur]) return;
    if (e.key === "ArrowRight") (e.preventDefault(), go(cur + 1));
    if (e.key === "ArrowLeft") (e.preventDefault(), go(cur - 1));
    if ((e.key === "Enter" || e.key === " ") && slides[cur]?.kind !== "room" && !blurred) (e.preventDefault(), setZoom(true));
  };

  const [sa, sb] = ROOM_SIZE_IN[size];
  const dims = aspect > 1.05 ? `${sb} × ${sa} in` : `${sa} × ${sb} in`;
  const slideName = (s: Slide) => (s.kind === "art" ? "The painting" : s.kind === "room" ? `${s.room.label}, ${dims}${frame ? `, ${frame} frame` : ""}` : `Close-up ${s.i + 1}`);
  const now = slides[cur] ?? slides[0];
  const thumbSrc = sized(imageUrl, 384);

  return (
    <section aria-label={`Pictures of ${title}`} className="min-w-0">
      <div className="group relative" onKeyDown={onStageKey}>
        <div
          ref={track}
          onScroll={onScroll}
          className="flex aspect-[5/4] snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-gallery [scrollbar-width:none] md:rounded-2xl [&::-webkit-scrollbar]:hidden"
        >
          {slides.map((s, i) => (
            <div
              key={s.kind === "room" ? `r${s.room.kind}${s.room.n}` : s.kind === "detail" ? `d${s.i}` : "art"}
              ref={(el) => {
                panels.current[i] = el;
              }}
              id={`gal-p${i}`}
              role="tabpanel"
              aria-labelledby={`gal-t${i}`}
              tabIndex={i === cur ? 0 : -1}
              className="relative h-full w-full shrink-0 snap-center snap-always overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-scan md:rounded-2xl"
            >
              {s.kind === "art" && (
                <div className="relative h-full w-full bg-[radial-gradient(ellipse_at_50%_0%,#f7f5f0_0%,#e9e6df_75%)]">
                  <Image
                    src={imageUrl}
                    alt={alt}
                    width={1200}
                    height={Math.round(1200 / (aspect || 0.8))}
                    priority
                    unoptimized={!canOptimize(imageUrl)}
                    sizes="(min-width: 768px) 50vw, 100vw"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalHeight) onAspect?.(img.naturalWidth / img.naturalHeight);
                    }}
                    onClick={() => !blurred && setZoom(true)}
                    className={cn(
                      "absolute inset-0 m-auto block h-auto max-h-[86%] w-auto max-w-[86%] border-[5px] border-white bg-white shadow-[0_18px_40px_-12px_rgba(21,22,27,.45),0_2px_6px_rgba(21,22,27,.12)] md:border-[9px]",
                      blurred ? "blur-xl" : "cursor-zoom-in",
                    )}
                  />
                  {blurred && (
                    <div className="absolute inset-0 grid place-content-center justify-items-center gap-2 bg-ink/25 p-3 text-center text-white">
                      <span className="text-[13px] font-bold drop-shadow">{sensitive.join(" · ")}</span>
                      <button type="button" onClick={() => setRevealed(true)} className="min-h-[44px] rounded-full bg-white px-5 text-[14px] font-bold text-ink">
                        Show
                      </button>
                    </div>
                  )}
                </div>
              )}
              {s.kind === "room" &&
                (seen.has(i) ? (
                  <RoomScene
                    scene={s.room.n}
                    slug={s.room.kind === "photo" ? slug : undefined}
                    imageUrl={imageUrl}
                    aspect={aspect}
                    size={size}
                    frame={frame}
                    blur={blurred}
                    eager={i === cur}
                    sizes="(min-width: 1024px) 680px, (min-width: 768px) 55vw, 100vw"
                    className="h-full"
                  />
                ) : (
                  <div className="h-full w-full bg-[radial-gradient(ellipse_at_50%_30%,#f7f5f0,#e7e3db)]" />
                ))}
              {s.kind === "detail" && seen.has(i) && <CloseUp src={sized(imageUrl, 1920)} d={s.d} aspect={aspect} />}
            </div>
          ))}
        </div>

        {/* what's on the stage: a room's size and the photo's credit, or which close-up */}
        {now.kind !== "art" && (
          <p className="pointer-events-none absolute bottom-2.5 left-2.5 right-2.5 flex flex-wrap items-center gap-x-1.5 sm:bottom-3 sm:left-3">
            <span className="pointer-events-auto max-w-full truncate rounded-full bg-white/95 px-2.5 py-1 text-[12.5px] font-semibold text-ink shadow-[0_1px_3px_rgba(21,22,27,.2)]">
              {now.kind === "room" ? (
                <>
                  {now.room.label} · <span className="num">{dims}</span>
                  {frame ? " · framed" : ""}
                  {now.room.credit && (
                    <span className="font-normal text-ink-2">
                      {" · "}
                      {now.room.url ? (
                        <a href={now.room.url} target="_blank" rel="noopener noreferrer" className="underline decoration-ink-2/40 underline-offset-2 hover:text-ink">
                          {now.room.credit}
                        </a>
                      ) : (
                        now.room.credit
                      )}
                    </span>
                  )}
                </>
              ) : (
                <>Close-up · about 3×</>
              )}
            </span>
          </p>
        )}

        {now.kind !== "room" && !blurred && (
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label="Zoom in on the painting"
            className="absolute right-2.5 top-2.5 grid h-10 w-10 place-items-center rounded-full bg-white/95 text-ink shadow-[0_2px_8px_rgba(21,22,27,.25)] transition hover:bg-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan"
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M13 13l4.5 4.5M8.5 6v5M6 8.5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {n > 1 && (
          <>
            <Arrow side="left" onClick={() => go(cur - 1)} />
            <Arrow side="right" onClick={() => go(cur + 1)} />
          </>
        )}
      </div>

      {n > 1 && (
        <div role="tablist" aria-label="Pictures" className="mt-2 flex justify-center gap-0.5 md:mt-3 md:justify-start md:gap-2" onKeyDown={onTabKey}>
          {slides.map((s, i) => {
            const on = i === cur;
            return (
              <button
                key={i}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`gal-t${i}`}
                aria-controls={`gal-p${i}`}
                aria-selected={on}
                aria-label={slideName(s)}
                tabIndex={on ? 0 : -1}
                onClick={() => go(i)}
                className="group/t grid h-6 w-6 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-scan md:block md:h-auto md:w-auto md:rounded-lg"
              >
                {/* phones: a dot */}
                <span className={cn("block h-2 rounded-full transition-all md:hidden", on ? "w-5 bg-ink" : "w-2 bg-ink/25")} aria-hidden />
                {/* wider screens: a thumbnail */}
                <span
                  className={cn(
                    "relative hidden aspect-[5/4] w-16 overflow-hidden rounded-lg bg-gallery ring-offset-2 transition md:block lg:w-[72px]",
                    on ? "ring-2 ring-ink" : "opacity-80 ring-1 ring-line hover:opacity-100",
                  )}
                  aria-hidden
                >
                  <Thumb s={s} idle={idle} thumbSrc={thumbSrc} slug={slug} imageUrl={imageUrl} aspect={aspect} size={size} frame={frame} blurred={blurred} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ArtZoom open={zoom} onClose={() => setZoom(false)} src={imageUrl} alt={alt} />
    </section>
  );
}

function Thumb({ s, idle, thumbSrc, slug, imageUrl, aspect, size, frame, blurred }: { s: Slide; idle: boolean; thumbSrc: string; slug: string; imageUrl: string; aspect: number; size: RoomSize; frame: RoomFrame | null; blurred: boolean }) {
  if (s.kind === "art")
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={thumbSrc} alt="" className={cn("absolute inset-0 m-auto max-h-[80%] max-w-[80%] border-2 border-white shadow-sm", blurred && "blur-sm")} />
    );
  if (s.kind === "detail") return <CloseUp src={thumbSrc} d={s.d} aspect={aspect} />;
  if (s.room.kind === "photo" && photoScenesOn)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoSrc(s.room.n, slug, size, frame, 480, { blur: blurred })} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
    );
  return idle ? <RoomScene scene={s.room.n} imageUrl={imageUrl} aspect={aspect} size={size} frame={frame} blur={blurred} className="h-full" /> : null;
}

function CloseUp({ src, d, aspect }: { src: string; d: Detail; aspect: number }) {
  const c = crop(d, aspect);
  return (
    <div className="absolute inset-0 overflow-hidden bg-gallery">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        decoding="async"
        draggable={false}
        className="absolute max-w-none select-none"
        style={{ width: `${100 / c.w}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%` }}
      />
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous picture" : "Next picture"}
      className={cn(
        "absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/95 text-ink opacity-0 shadow-[0_2px_8px_rgba(21,22,27,.2)] transition hover:bg-white focus-visible:opacity-100 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan group-hover:opacity-100 md:grid",
        side === "left" ? "left-2.5" : "right-2.5",
      )}
    >
      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden>
        <path d={side === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
