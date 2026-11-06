"use client";
// The photo editor for paintings: crop (free or the original's shape), rotate 90°, straighten (±10°) and
// "Fix angle" (drag 4 corners onto a painting shot at a slant). Everything previews on a canvas from the 1600px
// public copy; nothing is uploaded until Save, which sends only the edit parameters to POST /api/uploads/edit.
// The server applies them to the full-resolution private original and returns a new upload (same shape as
// POST /api/uploads), plus the edits to store on the artwork so they can be changed or reset later.
//
// Touch: drag handles, pinch to zoom, two fingers to pan. Mouse: drag, scroll wheel to zoom.
// Keyboard: Tab to a handle, arrow keys nudge it (Shift = more), + / − zoom, 0 fits, Esc cancels.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Minus, Plus, RotateCw, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { Problem } from "@/components/studio/Problem";
import {
  convex, flatSize, isIdentity, NO_EDITS, printImpact, straightenScale, warp,
  type ImageEdits, type Pt, type Quad, type Rect, type StoredEdits,
} from "@/lib/imageEdits";
import { homography, type P } from "@/lib/scenes/geometry";
import { EditorDialog } from "./EditorDialog";
import { loadImage, useGestures, useSize, type XY } from "./gestures";

/** What Save hands back: a stored image exactly like POST /api/uploads returns, plus the edits (null = none). */
export type EditResult = { url: string; width: number; height: number; printable: string[]; printableSig: string; edits: StoredEdits | null };

type Props = {
  /** The untouched upload (its preview URL). For an edited artwork, its stored edits' source. */
  source: string;
  /** Full-resolution size of the source, when known (fetched otherwise). */
  sourceSize?: { w: number; h: number } | null;
  /** Edits already applied (re-editing). */
  initial?: ImageEdits | null;
  /** The current edited image, so a re-edit replaces it instead of piling up files. */
  previous?: string | null;
  /** The painting's real size in inches, for the "Original" crop shape and the flattened shape. */
  originalSize?: { w: number; h: number } | null;
  /** Opened by itself right after an upload: Skip / Looks good instead of Cancel / Save. */
  auto?: boolean;
  /** Runs after the server stored the edit, before the editor closes (e.g. save it to an existing artwork). Throw to stay open with the error. */
  commit?: (result: EditResult) => Promise<void>;
  /** null = closed without changes. */
  onDone: (result: EditResult | null) => void;
};

type Mode = "crop" | "angle";
type Corner = 0 | 1 | 2 | 3;
const CORNER_NAMES = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"] as const;
const FULL_QUAD: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
const PAD = 26;
const MIN_CROP = 0.05;
const MAX_ZOOM = 6;
const STAGE_BG = "#1d1e23";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const near = (a: Quad, b: Quad) => a.every((p, i) => Math.abs(p[0] - b[i][0]) < 0.004 && Math.abs(p[1] - b[i][1]) < 0.004);
/** Just the edit fields (stored edits also carry their source). */
const pick = (e: ImageEdits): ImageEdits => ({ rotate: e.rotate, corners: e.corners ?? null, aspect: e.aspect ?? null, angle: e.angle || 0, crop: e.crop ?? null });
const sameEdits = (a: ImageEdits, b: ImageEdits) => JSON.stringify(pick(a)) === JSON.stringify(pick(b));

/** Image turned by a quarter turn clockwise, drawn to a canvas. */
function turnedCanvas(img: HTMLImageElement, rotate: number) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const side = rotate === 90 || rotate === 270;
  const c = document.createElement("canvas");
  c.width = side ? h : w;
  c.height = side ? w : h;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);
  return c;
}

/** The flattened painting for the preview (long edge ≤ 1200px). null when the image can't be read (cross-origin). */
function flattenedCanvas(a: HTMLCanvasElement, corners: Quad, aspect: number | null): HTMLCanvasElement | null {
  try {
    const f = flatSize(corners, a.width, a.height, aspect);
    const k = Math.min(1, 1200 / Math.max(f.w, f.h));
    const bw = Math.max(2, Math.round(f.w * k)), bh = Math.max(2, Math.round(f.h * k));
    const H = homography([[0, 0], [bw, 0], [bw, bh], [0, bh]], corners.map(([x, y]) => [x * a.width, y * a.height] as P));
    const src = a.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, a.width, a.height);
    const px = warp(src.data, a.width, a.height, 4, H, bw, bh);
    const c = document.createElement("canvas");
    c.width = bw;
    c.height = bh;
    const out = c.getContext("2d")!.createImageData(bw, bh);
    out.data.set(px);
    c.getContext("2d")!.putImageData(out, 0, 0);
    return c;
  } catch {
    return null;
  }
}

/** Largest rect of shape `r` (w/h in px of a cw×ch image) centred inside `inside`. */
function fitRect(r: number, cw: number, ch: number, inside: Rect): Rect {
  const iwPx = inside.w * cw, ihPx = inside.h * ch;
  let w = iwPx, h = w / r;
  if (h > ihPx) { h = ihPx; w = h * r; }
  const nw = w / cw, nh = h / ch;
  return { x: inside.x + (inside.w - nw) / 2, y: inside.y + (inside.h - nh) / 2, w: nw, h: nh };
}

export default function ImageEditor({ source, sourceSize, initial, previous, originalSize, auto, commit, onDone }: Props) {
  const start = useMemo<ImageEdits>(() => pick({ ...NO_EDITS, ...(initial || {}) }), [initial]);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [full, setFull] = useState<{ w: number; h: number; original?: boolean } | null>(sourceSize?.w ? sourceSize : null);
  const [edits, setEdits] = useState<ImageEdits>(start);
  const [mode, setMode] = useState<Mode>("crop");
  const [view, setView] = useState({ z: 1, x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [drag, setDrag] = useState<string | null>(null);
  const [lockOriginal, setLockOriginal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; fix?: { label: string; href?: string } } | null>(null);
  const cornersAtEnter = useRef<Quad | null>(null);
  // A stored edit whose commit failed: retrying the same edits only retries the commit.
  const pending = useRef<{ key: string; data: EditResult } | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);

  // The original's shape (w/h), turned with the photo.
  const origRatio = originalSize && originalSize.w > 0 && originalSize.h > 0 ? originalSize.w / originalSize.h : null;
  const turnedRatio = origRatio;

  useEffect(() => {
    let live = true;
    loadImage(source).then((i) => live && setImg(i), () => live && setLoadError(true));
    return () => { live = false; };
  }, [source]);

  // Full-resolution size (what prints), when the caller didn't know it.
  useEffect(() => {
    if (full) return;
    let live = true;
    fetch(`/api/uploads/edit?source=${encodeURIComponent(source)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.width) setFull({ w: d.width, h: d.height, original: d.original }); })
      .catch(() => {});
    return () => { live = false; };
  }, [source, full]);

  const A = useMemo(() => (img ? turnedCanvas(img, edits.rotate) : null), [img, edits.rotate]);
  const flat = useMemo(() => {
    if (!A || mode !== "crop" || !edits.corners) return { B: A, blocked: false };
    const f = flattenedCanvas(A, edits.corners, edits.aspect);
    return f ? { B: f, blocked: false } : { B: A, blocked: true };
  }, [A, mode, edits.corners, edits.aspect]);
  const { B, blocked } = flat;

  // Image on screen: the turned photo while fixing the angle, the straightened result while cropping.
  const ss = B ? straightenScale(B.width, B.height, mode === "crop" ? edits.angle : 0) : 1;
  const iw = mode === "angle" ? A?.width || 1 : (B?.width || 1) * ss;
  const ih = mode === "angle" ? A?.height || 1 : (B?.height || 1) * ss;
  const fit = Math.max(0.0001, Math.min((size.w - PAD * 2) / iw, (size.h - PAD * 2) / ih));
  const scale = fit * view.z;
  const ox = size.w / 2 + view.x - (iw * scale) / 2;
  const oy = size.h / 2 + view.y - (ih * scale) / 2;
  const toScreen = useCallback((p: Pt): XY => ({ x: ox + p[0] * iw * scale, y: oy + p[1] * ih * scale }), [ox, oy, iw, ih, scale]);
  const toNorm = useCallback((p: XY): Pt => [(p.x - ox) / (iw * scale), (p.y - oy) / (ih * scale)], [ox, oy, iw, ih, scale]);

  const crop = edits.crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const corners = edits.corners ?? FULL_QUAD;

  useSize(stageRef, (w, h) => setSize({ w, h }));

  // ---------- drawing ----------
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !size.w) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(size.w * dpr) || cv.height !== Math.round(size.h * dpr)) {
      cv.width = Math.round(size.w * dpr);
      cv.height = Math.round(size.h * dpr);
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = STAGE_BG;
    ctx.fillRect(0, 0, size.w, size.h);
    ctx.imageSmoothingQuality = "high";
    if (mode === "angle" && A) {
      ctx.drawImage(A, ox, oy, iw * scale, ih * scale);
    } else if (B) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ox, oy, iw * scale, ih * scale);
      ctx.clip();
      ctx.translate(ox + (iw * scale) / 2, oy + (ih * scale) / 2);
      ctx.rotate((edits.angle * Math.PI) / 180);
      ctx.drawImage(B, (-B.width * scale) / 2, (-B.height * scale) / 2, B.width * scale, B.height * scale);
      ctx.restore();
    }
  }, [A, B, mode, size, ox, oy, iw, ih, scale, edits.angle]);

  // Magnifier while a corner is dragged (the finger hides the corner).
  const loupeAt = drag?.startsWith("q") ? corners[Number(drag.slice(1))] : null;
  useEffect(() => {
    const cv = loupeRef.current;
    if (!cv || !loupeAt || !A) return;
    const S = 116;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = S * dpr;
    cv.height = S * dpr;
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const mag = Math.max(2.5, scale * 3);
    const cx = loupeAt[0] * A.width, cy = loupeAt[1] * A.height;
    const half = S / 2 / mag;
    ctx.fillStyle = STAGE_BG;
    ctx.fillRect(0, 0, S, S);
    ctx.drawImage(A, cx - half, cy - half, half * 2, half * 2, 0, 0, S, S);
    ctx.strokeStyle = "#ffd43b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S); ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
    ctx.stroke();
  }, [loupeAt, A, scale]);

  // ---------- view ----------
  const clampView = useCallback((v: { z: number; x: number; y: number }) => {
    const z = clamp(v.z, 1, MAX_ZOOM);
    const s = fit * z;
    const mx = Math.max(0, (iw * s - (size.w - PAD * 2)) / 2), my = Math.max(0, (ih * s - (size.h - PAD * 2)) / 2);
    return { z, x: clamp(v.x, -mx, mx), y: clamp(v.y, -my, my) };
  }, [fit, iw, ih, size]);
  const zoomAt = useCallback((factor: number, c: XY, pan: XY = { x: 0, y: 0 }) => {
    setView((v) => {
      const z = clamp(v.z * factor, 1, MAX_ZOOM);
      const f = z / v.z;
      return clampView({ z, x: c.x - size.w / 2 - (c.x - size.w / 2 - v.x) * f + pan.x, y: c.y - size.h / 2 - (c.y - size.h / 2 - v.y) * f + pan.y });
    });
  }, [clampView, size]);
  const zoomBy = (factor: number) => zoomAt(factor, { x: size.w / 2, y: size.h / 2 });

  // ---------- edits ----------
  const setCrop = (c: Rect | null) => setEdits((e) => ({ ...e, crop: c }));

  /** Crop corner k (0 TL, 1 TR, 2 BR, 3 BL) moved to p (normalized), keeping the opposite corner, the bounds and the shape. */
  const moveCropCorner = (k: Corner, p: Pt) => {
    const c = crop;
    const fx = k === 0 || k === 3 ? c.x + c.w : c.x; // fixed x
    const fy = k === 0 || k === 1 ? c.y + c.h : c.y;
    const left = k === 0 || k === 3, top = k === 0 || k === 1;
    let w = left ? fx - clamp(p[0], 0, fx - MIN_CROP) : clamp(p[0], fx + MIN_CROP, 1) - fx;
    let h = top ? fy - clamp(p[1], 0, fy - MIN_CROP) : clamp(p[1], fy + MIN_CROP, 1) - fy;
    if (lockOriginal && turnedRatio) {
      const toH = (ww: number) => (ww * iw) / turnedRatio / ih;
      const toW = (hh: number) => (hh * ih * turnedRatio) / iw;
      if (toH(w) > h) w = toW(h); else h = toH(w);
      const maxW = left ? fx : 1 - fx, maxH = top ? fy : 1 - fy;
      if (w > maxW) { w = maxW; h = toH(w); }
      if (h > maxH) { h = maxH; w = toW(h); }
    }
    setCrop({ x: left ? fx - w : fx, y: top ? fy - h : fy, w, h });
  };
  const moveCrop = (dx: number, dy: number) => setCrop({ ...crop, x: clamp(crop.x + dx, 0, 1 - crop.w), y: clamp(crop.y + dy, 0, 1 - crop.h) });
  const moveCorner = (k: Corner, p: Pt) => {
    const q = corners.map((c) => [...c]) as Quad;
    q[k] = [clamp(p[0], 0, 1), clamp(p[1], 0, 1)];
    if (convex(q)) setEdits((e) => ({ ...e, corners: q }));
  };

  // ---------- gestures ----------
  const hit = (p: XY): string | null => {
    const pts: Pt[] = mode === "angle" ? corners : [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x + crop.w, crop.y + crop.h], [crop.x, crop.y + crop.h]];
    let best = -1, bestD = 30;
    pts.forEach((q, i) => {
      const s = toScreen(q);
      const d = Math.hypot(s.x - p.x, s.y - p.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0) return (mode === "angle" ? "q" : "c") + best;
    if (mode === "crop") {
      const [u, v] = toNorm(p);
      if (u > crop.x && u < crop.x + crop.w && v > crop.y && v < crop.y + crop.h) return "move";
    }
    return view.z > 1 ? "pan" : null;
  };
  useGestures(stageRef, {
    start: (p) => { const k = hit(p); setDrag(k); return k; },
    move: (kind, p, d) => {
      if (kind === "pan") setView((v) => clampView({ ...v, x: v.x + d.x, y: v.y + d.y }));
      else if (kind === "move") moveCrop(d.x / (iw * scale), d.y / (ih * scale));
      else if (kind[0] === "c") moveCropCorner(Number(kind.slice(1)) as Corner, toNorm(p));
      else if (kind[0] === "q") moveCorner(Number(kind.slice(1)) as Corner, toNorm(p));
    },
    end: () => setDrag(null),
    zoom: (f, c, pan) => zoomAt(f, c, pan),
  });

  /** Arrow keys on a handle: nudge it (2px on screen, Shift 10px, so zooming in gives finer steps). */
  const nudge = (kind: string) => (e: ReactKeyboardEvent) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dirs[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 10 : 2;
    const dx = (d[0] * step) / (iw * scale), dy = (d[1] * step) / (ih * scale);
    if (kind === "move") moveCrop(dx, dy);
    else if (kind[0] === "c") {
      const k = Number(kind.slice(1)) as Corner;
      const pt: Pt = [k === 0 || k === 3 ? crop.x : crop.x + crop.w, k === 0 || k === 1 ? crop.y : crop.y + crop.h];
      moveCropCorner(k, [pt[0] + dx, pt[1] + dy]);
    } else if (kind[0] === "q") {
      const k = Number(kind.slice(1)) as Corner;
      moveCorner(k, [corners[k][0] + dx, corners[k][1] + dy]);
    }
  };

  const onKeys = (e: ReactKeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.25); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(0.8); }
    else if (e.key === "0") { e.preventDefault(); setView({ z: 1, x: 0, y: 0 }); }
  };

  // ---------- tools ----------
  function rotate() {
    setEdits((e) => ({
      ...e,
      rotate: ((e.rotate + 90) % 360) as ImageEdits["rotate"],
      // corners and crop turn with the picture (old bottom-left becomes the new top-left)
      corners: e.corners ? ([e.corners[3], e.corners[0], e.corners[1], e.corners[2]].map(([u, v]) => [1 - v, u]) as Quad) : null,
      aspect: e.aspect ? 1 / e.aspect : null,
      crop: e.crop ? { x: 1 - e.crop.y - e.crop.h, y: e.crop.x, w: e.crop.h, h: e.crop.w } : null,
    }));
    setLockOriginal(false);
    setView({ z: 1, x: 0, y: 0 });
  }

  function enterAngle() {
    if (mode === "angle") return;
    cornersAtEnter.current = edits.corners;
    setMode("angle");
    setView({ z: 1, x: 0, y: 0 });
  }

  function enterCrop() {
    if (mode === "crop") return;
    setEdits((e) => {
      const q = e.corners && near(e.corners, FULL_QUAD) ? null : e.corners;
      const changed = JSON.stringify(q) !== JSON.stringify(cornersAtEnter.current);
      return { ...e, corners: q, aspect: q && origRatio ? origRatio : null, crop: changed ? null : e.crop };
    });
    setLockOriginal(false);
    setMode("crop");
    setView({ z: 1, x: 0, y: 0 });
  }

  function lockToOriginal(on: boolean) {
    setLockOriginal(on);
    if (on && turnedRatio) setCrop(fitRect(turnedRatio, iw, ih, crop));
  }

  function reset() {
    setEdits(NO_EDITS);
    setMode("crop");
    setLockOriginal(false);
    setView({ z: 1, x: 0, y: 0 });
  }

  // ---------- save ----------
  const finalEdits = useMemo<ImageEdits>(() => {
    const q = edits.corners && near(edits.corners, FULL_QUAD) ? null : edits.corners;
    const c = edits.crop && (edits.crop.x > 0.0005 || edits.crop.y > 0.0005 || edits.crop.w < 0.999 || edits.crop.h < 0.999) ? edits.crop : null;
    return { ...edits, corners: q, aspect: q ? (mode === "angle" ? (origRatio ?? null) : edits.aspect) : null, crop: mode === "angle" && JSON.stringify(q) !== JSON.stringify(cornersAtEnter.current) ? null : c, angle: Math.round(edits.angle * 10) / 10 };
  }, [edits, mode, origRatio]);
  const changed = !sameEdits(finalEdits, start);
  const startEdited = !isIdentity(start);
  const impact = full ? printImpact(full.w, full.h, finalEdits) : null;

  async function save() {
    if (saving) return;
    setError(null);
    if (!changed) { onDone(null); return; }
    setSaving(true);
    const key = JSON.stringify(finalEdits);
    try {
      let data = pending.current?.key === key ? pending.current.data : null;
      if (!data) {
        const res = await fetch("/api/uploads/edit", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source, edits: finalEdits, replace: pending.current?.data.url ?? (previous && previous !== source ? previous : undefined) }),
        });
        if (!res.ok) {
          const p = await problemFrom(res, "Couldn't save your edits. Try again.");
          setError({ message: p.message, fix: p.fix });
          failed(p.message, { fix: p.fix, retry: p.fix ? undefined : save });
          return;
        }
        data = (await res.json()) as EditResult;
      }
      if (commit) {
        try {
          await commit(data);
        } catch (e) {
          pending.current = { key, data };
          const m = errorText(e, "Couldn't save the photo to this piece. Try again.");
          setError({ message: m });
          failed(m, { retry: save });
          return;
        }
      }
      pending.current = null;
      saved(data.edits ? "Photo saved" : "Edits reset", { description: impact?.tone === "warn" ? impact.text : undefined });
      onDone(data);
    } catch {
      setError({ message: "You seem to be offline. Your edits are still here." });
      failed("You seem to be offline", { description: "Your edits are still here. Check your connection and try again.", retry: save });
    } finally {
      setSaving(false);
    }
  }

  const cancel = () => { if (!saving) onDone(null); };

  // ---------- render ----------
  const handlePts: Pt[] = mode === "angle" ? corners : [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x + crop.w, crop.y + crop.h], [crop.x, crop.y + crop.h]];
  const hs = handlePts.map(toScreen);
  const imgBox = { x: ox, y: oy, w: iw * scale, h: ih * scale };
  const cropBox = { x: hs[0].x, y: hs[0].y, w: hs[2].x - hs[0].x, h: hs[2].y - hs[0].y };
  const poly = hs.map((p) => `${p.x},${p.y}`).join(" ");
  const loupeLeft = loupeAt ? toScreen(loupeAt).x > size.w / 2 : true;

  return (
    <EditorDialog label="Edit photo" onClose={cancel}>
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeys}>
        {/* Top: title and the two tools */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <h2 className="t-card">Edit photo</h2>
          <div role="tablist" aria-label="Tool" className="flex rounded-full border-[1.5px] border-edge-strong p-0.5">
            {([["crop", "Crop"], ["angle", "Fix angle"]] as const).map(([m, label]) => (
              <button
                key={m} type="button" role="tab" aria-selected={mode === m} data-autofocus={m === "crop" ? "" : undefined}
                onClick={() => (m === "crop" ? enterCrop() : enterAngle())}
                className={cn("min-h-[40px] rounded-full px-4 text-[14px] font-bold", mode === m ? "bg-ink text-white" : "text-ink hover:bg-wall")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stage */}
        <div
          ref={stageRef} tabIndex={0} aria-label="Photo. Use + and − to zoom."
          className="relative min-h-0 flex-1 touch-none select-none overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-scan"
          style={{ background: STAGE_BG, cursor: drag === "pan" || drag === "move" ? "grabbing" : view.z > 1 ? "grab" : undefined }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          {!img && !loadError && <span className="absolute inset-0 grid place-items-center text-white/80"><Loader2 className="h-7 w-7 animate-spin" aria-label="Loading photo" /></span>}
          {loadError && (
            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2">
              <Problem tone="error" title="We couldn't open this photo." fix={{ label: "Close", onClick: cancel }}>Close and try again, or upload it again.</Problem>
            </div>
          )}
          {img && size.w > 0 && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <mask id="af-edit-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {mode === "angle" ? <polygon points={poly} fill="black" /> : <rect x={cropBox.x} y={cropBox.y} width={cropBox.w} height={cropBox.h} fill="black" />}
                </mask>
              </defs>
              <rect x={imgBox.x} y={imgBox.y} width={imgBox.w} height={imgBox.h} fill="rgba(13,14,18,.62)" mask="url(#af-edit-mask)" />
              {mode === "angle" ? (
                <polygon points={poly} fill="none" stroke="#ffd43b" strokeWidth="2" />
              ) : (
                <>
                  <rect x={cropBox.x} y={cropBox.y} width={cropBox.w} height={cropBox.h} fill="none" stroke="#fff" strokeWidth="2" />
                  {(drag || Math.abs(edits.angle) > 0.05) && [1, 2].map((i) => (
                    <g key={i} stroke="rgba(255,255,255,.55)" strokeWidth="1">
                      <line x1={cropBox.x + (cropBox.w * i) / 3} x2={cropBox.x + (cropBox.w * i) / 3} y1={cropBox.y} y2={cropBox.y + cropBox.h} />
                      <line y1={cropBox.y + (cropBox.h * i) / 3} y2={cropBox.y + (cropBox.h * i) / 3} x1={cropBox.x} x2={cropBox.x + cropBox.w} />
                    </g>
                  ))}
                </>
              )}
            </svg>
          )}
          {img && size.w > 0 && mode === "crop" && (
            <button
              type="button" aria-label="Crop area. Arrow keys move it." onKeyDown={nudge("move")}
              className="absolute rounded-none outline-none focus-visible:ring-[3px] focus-visible:ring-scan"
              style={{ left: cropBox.x, top: cropBox.y, width: Math.max(0, cropBox.w), height: Math.max(0, cropBox.h), cursor: "move" }}
            />
          )}
          {img && size.w > 0 && hs.map((p, i) => (
            <button
              key={`${mode}${i}`} type="button" onKeyDown={nudge((mode === "angle" ? "q" : "c") + i)}
              aria-label={`${CORNER_NAMES[i]} ${mode === "angle" ? "painting corner" : "crop corner"}. Arrow keys move it.`}
              className="group absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full outline-none"
              style={{ left: p.x, top: p.y, cursor: "grab" }}
            >
              <span className={cn("block rounded-full border-[3px] shadow-[0_1px_6px_rgba(0,0,0,.5)] group-focus-visible:ring-[3px] group-focus-visible:ring-scan", mode === "angle" ? "h-6 w-6 border-ink bg-sticker" : "h-5 w-5 border-ink bg-white", drag === (mode === "angle" ? "q" : "c") + i && "scale-110")} />
            </button>
          ))}
          {loupeAt && (
            <canvas ref={loupeRef} aria-hidden="true" className={cn("pointer-events-none absolute top-3 h-[116px] w-[116px] rounded-full border-[3px] border-white shadow-lg", loupeLeft ? "left-3" : "right-3")} />
          )}
          <div className="absolute bottom-3 right-3 flex gap-1.5">
            <button type="button" onClick={() => zoomBy(0.8)} disabled={view.z <= 1} aria-label="Zoom out" className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => zoomBy(1.25)} disabled={view.z >= MAX_ZOOM} aria-label="Zoom in" className="grid h-10 w-10 place-items-center rounded-full bg-white/90 text-ink shadow disabled:opacity-40"><Plus className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </div>

        {/* Tool controls */}
        <div className="grid gap-2.5 border-t border-line px-4 py-3">
          {/* Opened by itself after an upload: say why, once, so Skip feels safe. */}
          {auto && mode === "crop" && <p className="t-small">Trim off the wall and frame so buyers see only the painting. Looks right already? Tap Looks good.</p>}
          {mode === "crop" ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
              <button type="button" onClick={rotate} className="btn btn-ghost btn-sm min-h-[40px]"><RotateCw className="h-4 w-4" aria-hidden="true" />Rotate</button>
              <label className="flex min-w-[220px] flex-1 items-center gap-2.5 text-[13.5px] font-semibold">
                <span className="shrink-0">Straighten</span>
                <input
                  type="range" min={-10} max={10} step={0.1} value={edits.angle}
                  onChange={(e) => setEdits((x) => ({ ...x, angle: Number(e.target.value) }))}
                  onDoubleClick={() => setEdits((x) => ({ ...x, angle: 0 }))}
                  onPointerDown={() => setDrag("angle")} onPointerUp={() => setDrag(null)}
                  aria-valuetext={`${edits.angle.toFixed(1)} degrees`}
                  className="h-10 min-w-0 flex-1 accent-[rgb(var(--af-scan-rgb))]"
                />
                <span className="num w-[46px] shrink-0 text-right text-ink-2">{edits.angle > 0 ? "+" : ""}{edits.angle.toFixed(1)}°</span>
              </label>
              {turnedRatio && (
                <div role="radiogroup" aria-label="Crop shape" className="flex gap-1.5">
                  {([[false, "Free"], [true, `Original ${originalSize!.w}×${originalSize!.h}`]] as const).map(([on, label]) => (
                    <button key={label} type="button" role="radio" aria-checked={lockOriginal === on} onClick={() => lockToOriginal(on)}
                      className={cn("min-h-[40px] rounded-full border-2 px-3.5 text-[13.5px] font-semibold", lockOriginal === on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="t-small min-w-0 flex-1 font-semibold !text-ink" role="status">Drag the dots onto the painting&apos;s corners.{origRatio ? <span className="font-normal text-ink-2"> Shaped to {originalSize!.w} × {originalSize!.h} in.</span> : null}</p>
              {edits.corners && !near(edits.corners, FULL_QUAD) && (
                <button type="button" onClick={() => { setEdits((e) => ({ ...e, corners: FULL_QUAD })); }} className="btn btn-ghost btn-sm min-h-[40px]"><Undo2 className="h-4 w-4" aria-hidden="true" />Undo fix</button>
              )}
            </div>
          )}
          {blocked && mode === "crop" && edits.corners && <p className="t-small">The flattened preview isn&apos;t available for this photo. It&apos;s applied when you save.</p>}
          {impact && <p className={cn("t-small", impact.tone === "warn" && "font-semibold !text-coral")} aria-live="polite">{impact.text}</p>}
          {full && full.original === false && <p className="t-small">No full-size original on file for this one, so edits use the web copy.</p>}
          {error && <Problem tone="error" title={error.message} fix={error.fix ?? { label: "Try again", onClick: save }} />}
        </div>

        {/* Actions: Save is the one primary */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={cancel} className="btn btn-ghost" disabled={saving}>{auto ? "Skip" : "Cancel"}</button>
          {(!isIdentity(finalEdits) || startEdited) && (
            <button type="button" onClick={reset} className="btn btn-ghost" disabled={saving || isIdentity(finalEdits)}>Reset</button>
          )}
          <button type="button" onClick={save} className="btn btn-blue ml-auto min-w-[132px]" disabled={saving || !img}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving ? "Saving" : changed ? "Save" : auto ? "Looks good" : "Done"}
          </button>
        </div>
      </div>
    </EditorDialog>
  );
}
