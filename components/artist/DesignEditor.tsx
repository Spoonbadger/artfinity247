"use client";

import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { failed, problemFrom, saved as savedToast } from "@/lib/feedback";
import { EmptyState } from "@/components/studio/EmptyState";
import Medal from "@/components/af/Medal";
import { cn } from "@/lib/utils";
import { LAYOUTS, MAX_PINNED, PAINTS, paint, type Layout, type PageTheme, type PaintId } from "./theme";

type Work = { id: string; title: string; imageUrl: string; sensitive: string[] };

const PHONE_W = 390;
const PHONE_H = 780;
const DESK_W = 1280;
const DESK_H = 820;

export default function DesignEditor({ slug, initial, works, hasMedal }: { slug: string; initial: PageTheme; works: Work[]; hasMedal: boolean }) {
  const [theme, setTheme] = useState<PageTheme>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const json = JSON.stringify(theme);
  const dirty = json !== saved;
  useUnsavedChanges(dirty && !saving);

  const set = <K extends keyof PageTheme>(k: K, v: PageTheme[K]) => setTheme((t) => ({ ...t, [k]: v }));

  function togglePin(id: string) {
    setTheme((t) => {
      if (t.pinned.includes(id)) return { ...t, pinned: t.pinned.filter((x) => x !== id) };
      if (t.pinned.length >= MAX_PINNED) {
        toast(`Pin up to ${MAX_PINNED}. Unpin one first.`);
        return t;
      }
      return { ...t, pinned: [...t.pinned, id] };
    });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/studio/design", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme }) });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't save your design.");
        failed(p.message, { description: res.status < 500 ? "" : undefined, fix: p.fix, retry: p.fix || res.status < 500 ? undefined : save });
        return;
      }
      const j = await res.json().catch(() => ({}));
      setTheme(j.theme);
      setSaved(JSON.stringify(j.theme));
      savedToast("Saved. Your page is updated.", { next: { label: "View page", href: `/@${slug}` } });
    } catch {
      failed("You seem to be offline", { description: "Your changes are still here. Check your connection and try again.", retry: save });
    } finally {
      setSaving(false);
    }
  }

  const accent = paint(theme.accent);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start xl:gap-10">
      {/* Preview: first on phones, right column on desktop */}
      <div className="lg:sticky lg:top-6 lg:order-2">
        <Preview slug={slug} json={json} />
      </div>

      <div className="grid gap-4 pb-24 lg:order-1 lg:pb-0">
        {/* Accent */}
        <Section title="Accent color" hint={accent.name}>
          <div role="radiogroup" aria-label="Accent color" className="grid grid-cols-5 gap-2.5">
            {PAINTS.map((p) => (
              <PaintButton key={p.id} id={p.id} on={theme.accent === p.id} onPick={() => set("accent", p.id)} />
            ))}
          </div>
        </Section>

        {/* Banner */}
        <Section title="Banner" hint={theme.banner.kind === "auto" ? "Your best seller" : theme.banner.kind === "art" ? "A piece of yours" : paint(theme.banner.paint).name}>
          <div className="grid gap-3">
            <div role="radiogroup" aria-label="Banner artwork" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
              <button
                type="button"
                role="radio"
                aria-checked={theme.banner.kind === "auto"}
                onClick={() => set("banner", { kind: "auto" })}
                className={cn("grid h-[68px] w-[92px] shrink-0 place-items-center rounded-lg border-2 bg-wall px-2 text-center text-[13px] font-bold leading-tight", theme.banner.kind === "auto" ? "border-ink ring-2 ring-ink ring-offset-2" : "border-line hover:border-ink")}
              >
                Best seller
              </button>
              {works.map((w) => {
                const on = theme.banner.kind === "art" && theme.banner.artworkId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`Banner: ${w.title}`}
                    title={w.title}
                    onClick={() => set("banner", { kind: "art", artworkId: w.id })}
                    className={cn("relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-lg border-2", on ? "border-ink ring-2 ring-ink ring-offset-2" : "border-transparent hover:border-ink")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.imageUrl} alt="" className={cn("h-full w-full object-cover", w.sensitive.length > 0 && "blur-sm")} loading="lazy" />
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-ink-2">Or solid paint</span>
              <div role="radiogroup" aria-label="Banner color" className="flex flex-wrap gap-1.5">
                {PAINTS.map((p) => {
                  const on = theme.banner.kind === "color" && theme.banner.paint === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={`Banner color: ${p.name}`}
                      title={p.name}
                      onClick={() => set("banner", { kind: "color", paint: p.id })}
                      className={cn("grid h-11 w-11 place-items-center rounded-full md:h-8 md:w-8", on && "ring-2 ring-ink ring-offset-2")}
                    >
                      <span className="paint-dab h-6 w-7 md:h-5 md:w-6" style={{ ["--dab" as string]: p.color }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Section>

        {/* Layout */}
        <Section title="Layout">
          <div role="radiogroup" aria-label="Layout" className="grid grid-cols-3 gap-2.5">
            {LAYOUTS.map((l) => {
              const on = theme.layout === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("layout", l.id)}
                  className={cn("grid gap-2 rounded-xl border-2 bg-white p-2 pb-2.5 text-left transition", on ? "border-ink shadow-[3px_3px_0_var(--af-ink)]" : "border-line hover:border-ink")}
                >
                  <LayoutSketch layout={l.id} color={accent.color} />
                  <span className="grid leading-tight">
                    <b className="text-[14px]">{l.name}</b>
                    <span className="text-[13px] text-ink-2">{l.note}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        {/* Pinned */}
        <Section title="Pinned pieces" hint={`${theme.pinned.length} of ${MAX_PINNED}`}>
          {works.length === 0 ? (
            <EmptyState
              compact
              title="Nothing to pin yet"
              body="Pin up to 3 favorite pieces to the top of your page. Your approved pieces show up here to pick from."
              action={{ label: "Add your first piece", href: "/studio/art/new" }}
            />
          ) : (
            <>
            <p className="t-small -mt-1">Pinned pieces show first on your page, in the order you tap them.</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {works.map((w) => {
                const i = theme.pinned.indexOf(w.id);
                const on = i >= 0;
                return (
                  <button
                    key={w.id}
                    type="button"
                    aria-pressed={on}
                    aria-label={on ? `Unpin ${w.title}` : `Pin ${w.title}`}
                    title={on ? `Unpin ${w.title}` : `Pin ${w.title}`}
                    onClick={() => togglePin(w.id)}
                    className={cn("relative aspect-[4/5] overflow-hidden rounded-[4px] border-2 transition", on ? "border-ink" : "border-transparent opacity-80 hover:opacity-100")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={w.imageUrl} alt="" className={cn("h-full w-full object-cover", w.sensitive.length > 0 && "blur-sm")} loading="lazy" />
                    {on && (
                      <span className="num absolute left-1 top-1 grid h-6 w-6 place-items-center rounded-full text-[12px] font-extrabold" style={{ background: accent.color, color: accent.ink }}>
                        {i + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            </>
          )}
        </Section>

        {/* Stats toggle */}
        <Section title="Medals and sales count">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <span className="flex items-center gap-2.5 text-[15px]">
              {hasMedal ? <Medal tier="gold" size={22} /> : <Medal tier="bronze" size={22} locked />}
              Show them on my page
            </span>
            <span className="relative inline-flex">
              <input type="checkbox" className="peer sr-only" checked={theme.showStats} onChange={(e) => set("showStats", e.target.checked)} />
              <span className="h-8 w-14 rounded-full border-2 border-ink bg-white transition peer-checked:bg-ink peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-scan" />
              <span className="absolute left-[5px] top-[5px] h-[22px] w-[22px] rounded-full bg-ink transition peer-checked:translate-x-6 peer-checked:bg-sticker" />
            </span>
          </label>
        </Section>

        {/* Save */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:static lg:rounded-2xl lg:border-[1.5px] lg:border-ink lg:px-4">
          <span className="text-[13.5px] text-ink-2" aria-live="polite">{dirty ? "Unsaved changes" : "All saved"}</span>
          <div className="flex gap-2">
            <Link href={`/@${slug}`} target="_blank" className="btn btn-ghost btn-sm min-h-[44px] md:min-h-0">View page</Link>
            <button type="button" className="btn btn-blue btn-sm min-h-[44px] md:min-h-0" disabled={!dirty || saving} onClick={save}>
              {saving ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="af-panel grid gap-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="t-card">{title}</h2>
        {hint && <span className="t-small truncate">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function PaintButton({ id, on, onPick }: { id: PaintId; on: boolean; onPick: () => void }) {
  const p = paint(id);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      aria-label={p.name}
      title={p.name}
      onClick={onPick}
      className={cn("group grid aspect-square place-items-center rounded-xl border-2 bg-white transition", on ? "border-ink" : "border-line hover:border-ink")}
    >
      <svg viewBox="0 0 40 40" className="h-[70%] w-[70%]" aria-hidden="true">
        <path d="M8 13c4-7 17-9 24-4 6 5 4 15-2 20-6 6-17 6-21 0-3-5-4-11-1-16z" fill={p.color} />
        <path d="M13 13c3-2 7-3 10-2" stroke="#fff" strokeOpacity=".45" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        {on && <path d="M13.5 20.5l4.5 4.5 9-10" stroke={p.ink} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      </svg>
    </button>
  );
}

function LayoutSketch({ layout, color }: { layout: Layout; color: string }) {
  const tile = "#d9d4c8";
  return (
    <svg viewBox="0 0 60 44" className="w-full rounded-md bg-wall" aria-hidden="true">
      {layout === "grid" &&
        [0, 1, 2].flatMap((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={6 + c * 17} y={5 + r * 18} width="14" height="15" rx="1" fill={c === 0 && r === 0 ? color : tile} />))}
      {layout === "single" && (
        <>
          <rect x="15" y="4" width="30" height="27" rx="1" fill={color} />
          <rect x="15" y="34" width="20" height="3" rx="1.5" fill={tile} />
        </>
      )}
      {layout === "salon" && (
        <>
          <rect x="5" y="5" width="22" height="20" fill={color} stroke="#2a2622" strokeWidth="1.2" />
          <rect x="30" y="5" width="11" height="15" fill={tile} stroke="#2a2622" strokeWidth="1.2" />
          <rect x="44" y="5" width="11" height="34" fill={tile} stroke="#2a2622" strokeWidth="1.2" />
          <rect x="5" y="28" width="13" height="11" fill={tile} stroke="#2a2622" strokeWidth="1.2" />
          <rect x="21" y="28" width="20" height="11" fill={tile} stroke="#2a2622" strokeWidth="1.2" />
          <rect x="30" y="22" width="11" height="3" fill="none" />
        </>
      )}
    </svg>
  );
}

/**
 * Live preview: the real public page in an iframe, with the unsaved theme in ?theme=.
 * Two frames swap on load so the preview never flashes blank between changes.
 */
function Preview({ slug, json }: { slug: string; json: string }) {
  const [device, setDevice] = useState<"phone" | "desktop">("phone");
  const [url, setUrl] = useState(() => `/@${slug}?theme=${encodeURIComponent(json)}`);
  const [frames, setFrames] = useState<[string, string]>([url, ""]);
  const [front, setFront] = useState(0);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);

  // Debounce theme changes into a new preview URL.
  useEffect(() => {
    const next = `/@${slug}?theme=${encodeURIComponent(json)}`;
    if (next === url) return;
    const t = setTimeout(() => setUrl(next), 300);
    return () => clearTimeout(t);
  }, [json, slug, url]);

  // Load the new URL into the back frame.
  useEffect(() => {
    if (frames[front] === url) return;
    setLoading(true);
    setFrames((f) => {
      const copy: [string, string] = [f[0], f[1]];
      copy[1 - front] = url;
      return copy;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBoxW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const w = device === "phone" ? PHONE_W : DESK_W;
  const h = device === "phone" ? PHONE_H : DESK_H;
  const bezel = device === "phone" ? 12 : 3; // frame border, both sides
  const scale = useMemo(() => (boxW ? Math.min(1, (boxW - bezel) / w) : 1), [boxW, w, bezel]);
  // On phones, keep the preview short enough to reach the controls.
  const visibleH = Math.round(h * scale * (device === "phone" ? 0.78 : 1));

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[14px] font-bold">
          <span className={cn("paint-dab", loading && "animate-pulse")} style={{ ["--dab" as string]: "var(--af-coral)" }} aria-hidden="true" />
          Live preview
        </span>
        <div role="radiogroup" aria-label="Preview size" className="flex rounded-full border-[1.5px] border-edge-strong p-0.5 text-[13px] font-bold">
          {(["phone", "desktop"] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={device === d}
              onClick={() => setDevice(d)}
              className={cn("min-h-[40px] rounded-full px-3 capitalize md:min-h-0 md:py-1", device === d ? "bg-ink text-white" : "text-ink")}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div ref={boxRef} className="w-full min-w-0">
        <div
          className={cn("relative mx-auto overflow-hidden bg-white shadow-[0_24px_48px_-24px_rgba(21,22,27,.45)]", device === "phone" ? "rounded-[28px] border-[6px] border-ink" : "rounded-xl border-[1.5px] border-ink")}
          style={{ width: Math.floor(w * scale) + bezel, height: visibleH, maxWidth: "100%" }}
        >
          {frames.map((src, i) =>
            src ? (
              <iframe
                key={i}
                src={src}
                title={i === front ? "Preview of your artist page" : "Loading preview"}
                aria-hidden={i !== front}
                tabIndex={i === front ? 0 : -1}
                onLoad={() => {
                  if (src === url || frames[1 - i] !== url) {
                    setFront(i);
                    setLoading(false);
                  }
                }}
                className={cn("absolute left-0 top-0 origin-top-left border-0 bg-white transition-opacity duration-200", i === front ? "z-10 opacity-100" : "z-0 opacity-0")}
                style={{ width: w, height: visibleH / scale, transform: `scale(${scale})` }}
              />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}
