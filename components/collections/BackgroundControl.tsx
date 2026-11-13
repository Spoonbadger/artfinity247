"use client";

// Studio: one "Background" button that opens the choices for a collection page's background.
// Clicks save right away; the sliders save a moment after they stop moving.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BG_COLORS, BLUR_MAX, DEFAULT_PAINTING, TINT_MAX, TINT_MIN, WALL_GRADIENT,
  backgroundLabel, backgroundTone, type BgColorId, type CollectionBackground,
} from "@/lib/collectionBackground";
import { backdropFill, PaintingLayer } from "@/components/collections/CollectionBackdrop";

type Piece = { id: string; title: string; imageUrl: string; sensitive: string[] };

const same = (a: CollectionBackground, b: CollectionBackground) => JSON.stringify(a) === JSON.stringify(b);

function Swatch({ on, label, style, onClick, small = false }: { on: boolean; label: string; style: CSSProperties; onClick: () => void; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      title={label}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border border-ink/15 transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan",
        small ? "h-6 w-6" : "h-9 w-9",
        on && "ring-2 ring-ink ring-offset-2",
      )}
      style={style}
    >
      {on && <Check className={cn("mix-blend-difference text-white", small ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />}
    </button>
  );
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-1">
      <span className="flex justify-between text-[13.5px] font-semibold">
        {label}<span className="num font-normal text-ink-2">{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-ink" />
    </label>
  );
}

export default function BackgroundControl({ value, pieces, title, onChange }: { value: CollectionBackground; pieces: Piece[]; title: string; onChange: (bg: CollectionBackground) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const sent = useRef(value);

  // The saved value can change underneath (e.g. its painting was taken out of the collection).
  useEffect(() => {
    if (!same(value, sent.current)) { sent.current = value; setDraft(value); }
  }, [value]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (bg: CollectionBackground, wait = 0) => {
    setDraft(bg);
    clearTimeout(timer.current);
    const send = () => { if (!same(bg, sent.current)) { sent.current = bg; onChange(bg); } };
    if (wait) timer.current = setTimeout(send, wait); else send();
  };

  const painting = draft.kind === "painting" ? draft : null;
  const piece = painting ? pieces.find((p) => p.id === painting.artworkId) ?? null : null;
  const tone = backgroundTone(draft);
  const image = piece && { url: piece.imageUrl, sensitive: piece.sensitive };
  const tune = (patch: Partial<typeof DEFAULT_PAINTING>, wait = 0) => painting && commit({ ...painting, ...patch }, wait);
  const pickPiece = (id: string) => commit({ kind: "painting", artworkId: id, ...(painting ? { blur: painting.blur, tint: painting.tint, tintOpacity: painting.tintOpacity } : DEFAULT_PAINTING) });

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-3 rounded-xl border-[1.5px] border-line px-3 py-2 text-left hover:border-ink"
      >
        <span className="relative isolate h-7 w-7 shrink-0 overflow-hidden rounded-full border border-ink/15" style={backdropFill(draft)}>
          <PaintingLayer bg={draft} image={image} scale={0.15} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="label block">Background</span>
          <b className="text-[15px]">{backgroundLabel(draft)}</b>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-ink-2 transition", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="grid gap-4 rounded-xl bg-wall p-3 sm:grid-cols-[minmax(0,1fr)_200px] sm:p-4">
          <div className="grid content-start gap-4">
            <div className="grid gap-2">
              <span className="text-[13.5px] font-semibold">Color</span>
              <div className="flex flex-wrap gap-2.5">
                <Swatch on={draft.kind === "wall"} label="Gallery wall" style={{ backgroundImage: WALL_GRADIENT }} onClick={() => commit({ kind: "wall" })} />
                {BG_COLORS.map((c) => (
                  <Swatch key={c.id} on={draft.kind === "color" && draft.color === c.id} label={c.name} style={{ backgroundColor: c.hex }} onClick={() => commit({ kind: "color", color: c.id })} />
                ))}
              </div>
            </div>

            {pieces.length > 0 && (
              <div className="grid gap-2">
                <span className="text-[13.5px] font-semibold">Or a painting from this collection</span>
                <div className="flex flex-wrap gap-2">
                  {pieces.map((p) => {
                    const on = painting?.artworkId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => pickPiece(p.id)}
                        aria-pressed={on}
                        aria-label={`Use ${p.title}`}
                        title={p.title}
                        className={cn("h-12 w-12 overflow-hidden rounded-md border border-ink/15 bg-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan", on && "ring-2 ring-ink ring-offset-2")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imageUrl} alt="" className={cn("h-full w-full object-cover", p.sensitive.length > 0 && "blur-[3px]")} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {painting && (
              <div className="grid gap-3">
                <Slider label="Blur" value={painting.blur} min={0} max={BLUR_MAX} unit="" onChange={(v) => tune({ blur: v }, 400)} />
                <div className="grid gap-2">
                  <span className="text-[13.5px] font-semibold">Tint</span>
                  <div className="flex flex-wrap gap-1.5">
                    {BG_COLORS.map((c) => (
                      <Swatch key={c.id} small on={painting.tint === c.id} label={`${c.name} tint`} style={{ backgroundColor: c.hex }} onClick={() => tune({ tint: c.id as BgColorId })} />
                    ))}
                  </div>
                </div>
                <Slider label="Tint strength" value={painting.tintOpacity} min={TINT_MIN} max={TINT_MAX} unit="%" onChange={(v) => tune({ tintOpacity: v }, 400)} />
                {piece && piece.sensitive.length > 0 && (
                  <p className="t-small">Marked sensitive, so it stays blurred for visitors who haven&apos;t chosen to see sensitive art.</p>
                )}
              </div>
            )}
          </div>

          {/* Live preview */}
          <div
            aria-hidden
            className={cn("relative isolate order-first grid aspect-[16/9] content-start justify-items-center gap-2 overflow-hidden rounded-lg px-3 pt-4 sm:order-none sm:aspect-auto sm:min-h-[260px] sm:pt-5", tone === "dark" ? "text-white" : "text-ink")}
            style={backdropFill(draft)}
          >
            <PaintingLayer bg={draft} image={image} scale={0.35} />
            <b className="display line-clamp-2 text-center text-[22px]">{title}</b>
            <div className="mt-3 flex items-start justify-center gap-3">
              {pieces.slice(0, 3).map((p, i) => (
                <span key={p.id} className={cn("block bg-white p-1 shadow-[0_8px_14px_-6px_rgba(21,22,27,.5)]", i === 1 && "mt-4")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt="" className={cn("block h-auto w-12 object-contain", p.sensitive.length > 0 && "blur-[3px]")} />
                </span>
              ))}
            </div>
          </div>
          {painting && !piece && <p className="t-small sm:col-span-2">That painting isn&apos;t in this collection anymore. Pick another, or a color.</p>}
        </div>
      )}
    </div>
  );
}
