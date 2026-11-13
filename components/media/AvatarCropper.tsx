"use client";
// Crop a profile photo (circle) or a cover image (wide rectangle) before it's uploaded.
// Drag to reposition, zoom with the slider, a pinch or the scroll wheel, rotate 90°. A live preview shows it at the
// sizes it's used. Save renders the crop on a canvas (avatars and covers aren't printed, so a 1024px JPEG is plenty)
// and hands the file to `onSave`, which uploads it.
// Keyboard: arrow keys move the photo (Shift = more), + / − zoom, Esc cancels.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { errorText, failed } from "@/lib/feedback";
import { Problem } from "@/components/studio/Problem";
import { EditorDialog } from "./EditorDialog";
import { loadImage, useGestures, useSize, type XY } from "./gestures";

type Props = {
  /** The picked file (object URL is made and freed here). */
  file: File;
  /** "circle" for a profile photo, "rect" for a cover or banner. */
  shape?: "circle" | "rect";
  /** Width / height of the crop (1 for a circle; e.g. 3 for a 3:1 banner). */
  aspect?: number;
  /** Output width in px. */
  outWidth?: number;
  title?: string;
  /** Uploads the cropped image. Throw to keep the cropper open with the error. */
  onSave: (file: File) => Promise<void>;
  onCancel: () => void;
  /** The browser can't open this file (e.g. HEIC outside Safari): upload it as it is instead. */
  onUnreadable?: (file: File) => void;
};

const MAX_ZOOM = 5;
const STAGE_BG = "#1d1e23";
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function AvatarCropper({ file, shape = "circle", aspect = 1, outWidth = 1024, title = "Profile photo", onSave, onCancel, onUnreadable }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [rotate, setRotate] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bigRef = useRef<HTMLCanvasElement>(null);
  const smallRef = useRef<HTMLCanvasElement>(null);
  const unreadable = useRef(onUnreadable);
  unreadable.current = onUnreadable;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    let live = true;
    loadImage(url).then((i) => live && setImg(i), () => { if (live) unreadable.current?.(file); });
    return () => { live = false; URL.revokeObjectURL(url); };
  }, [file]);

  useSize(stageRef, (w, h) => setSize({ w, h }));

  // The crop frame, centred in the stage.
  const fw = Math.max(40, Math.min(size.w - 40, (size.h - 40) * aspect));
  const fh = fw / aspect;
  const side = rotate % 180 !== 0;
  const iw = img ? (side ? img.naturalHeight : img.naturalWidth) : 1;
  const ih = img ? (side ? img.naturalWidth : img.naturalHeight) : 1;
  const base = Math.max(fw / iw, fh / ih); // cover the frame at zoom 1

  const limit = (o: XY, z: number) => {
    const mx = Math.max(0, (iw * base * z - fw) / 2), my = Math.max(0, (ih * base * z - fh) / 2);
    return { x: clamp(o.x, -mx, mx), y: clamp(o.y, -my, my) };
  };
  const zoomTo = (z: number, at?: XY) => {
    const nz = clamp(z, 1, MAX_ZOOM);
    // keep the point under the fingers (relative to the frame centre) in place
    const c = at ? { x: at.x - size.w / 2, y: at.y - size.h / 2 } : { x: 0, y: 0 };
    const f = nz / zoom;
    setOff((o) => limit({ x: c.x - (c.x - o.x) * f, y: c.y - (c.y - o.y) * f }, nz));
    setZoom(nz);
  };

  /** Draws the photo with the current crop into ctx, where the frame is `w`×`w/aspect` at (x, y). */
  function paint(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
    if (!img) return;
    const k = w / fw;
    const s = base * zoom * k;
    ctx.save();
    ctx.translate(x + w / 2 + off.x * k, y + w / aspect / 2 + off.y * k);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, (-img.naturalWidth * s) / 2, (-img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
  }

  useEffect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cv = canvasRef.current;
    if (cv && size.w) {
      cv.width = Math.round(size.w * dpr);
      cv.height = Math.round(size.h * dpr);
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = STAGE_BG;
      ctx.fillRect(0, 0, size.w, size.h);
      paint(ctx, (size.w - fw) / 2, (size.h - fh) / 2, fw);
    }
    for (const [ref, w] of [[bigRef, 96], [smallRef, 40]] as const) {
      const c = ref.current;
      if (!c) continue;
      const pw = shape === "circle" ? w : w * 2.4;
      c.width = Math.round(pw * dpr);
      c.height = Math.round((pw / aspect) * dpr);
      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, pw, pw / aspect);
      paint(ctx, 0, 0, pw);
    }
  });

  useGestures(stageRef, {
    start: () => "pan",
    move: (_k, _p, d) => setOff((o) => limit({ x: o.x + d.x, y: o.y + d.y }, zoom)),
    zoom: (f, c, pan) => { zoomTo(zoom * f, c); if (pan.x || pan.y) setOff((o) => limit({ x: o.x + pan.x, y: o.y + pan.y }, zoom * f)); },
  });

  const onKeys = (e: ReactKeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    const step = e.shiftKey ? 20 : 4;
    const d: Record<string, XY> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    if (d[e.key]) { e.preventDefault(); setOff((o) => limit({ x: o.x + d[e.key].x, y: o.y + d[e.key].y }, zoom)); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomTo(zoom * 1.15); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomTo(zoom / 1.15); }
  };

  async function save() {
    if (!img || saving) return;
    setSaving(true);
    setError(null);
    try {
      const out = document.createElement("canvas");
      out.width = outWidth;
      out.height = Math.round(outWidth / aspect);
      const ctx = out.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out.width, out.height);
      paint(ctx, 0, 0, outWidth);
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/jpeg", 0.9));
      if (!blob) throw new Error("Couldn't make the picture. Try again.");
      await onSave(new File([blob], shape === "circle" ? "profile.jpg" : "cover.jpg", { type: "image/jpeg" }));
    } catch (e) {
      const m = errorText(e, "Photo not saved. Try again.");
      setError(m);
      failed(m, { retry: save });
    } finally {
      setSaving(false);
    }
  }

  const changed = rotate !== 0 || zoom !== 1 || off.x !== 0 || off.y !== 0;
  const fx = (size.w - fw) / 2, fy = (size.h - fh) / 2;

  return (
    <EditorDialog label={title} onClose={() => !saving && onCancel()} wide={shape !== "circle"}>
      <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeys}>
        <div className="border-b border-line px-4 py-3">
          <h2 className="font-display text-[22px] font-bold [font-variation-settings:'wdth'_80]">{title}</h2>
        </div>
        <div
          ref={stageRef} tabIndex={0} data-autofocus aria-label="Photo. Drag or use arrow keys to move it, + and − to zoom."
          className="relative min-h-[260px] flex-1 cursor-grab touch-none select-none overflow-hidden outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-scan active:cursor-grabbing"
          style={{ background: STAGE_BG }}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          {!img && <span className="absolute inset-0 grid place-items-center text-white/80"><Loader2 className="h-7 w-7 animate-spin" aria-label="Loading photo" /></span>}
          {size.w > 0 && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <defs>
                <mask id="af-avatar-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {shape === "circle" ? <circle cx={size.w / 2} cy={size.h / 2} r={fw / 2} fill="black" /> : <rect x={fx} y={fy} width={fw} height={fh} fill="black" />}
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(13,14,18,.66)" mask="url(#af-avatar-mask)" />
              {shape === "circle" ? <circle cx={size.w / 2} cy={size.h / 2} r={fw / 2} fill="none" stroke="#fff" strokeWidth="2" /> : <rect x={fx} y={fy} width={fw} height={fh} fill="none" stroke="#fff" strokeWidth="2" />}
            </svg>
          )}
        </div>

        <div className="grid gap-3 border-t border-line px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <label className="flex min-w-[200px] flex-1 items-center gap-2.5 text-[13.5px] font-semibold">
              <span className="shrink-0">Zoom</span>
              <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={zoom} onChange={(e) => zoomTo(Number(e.target.value))} aria-valuetext={`${Math.round(zoom * 100)}%`} className="h-10 min-w-0 flex-1 accent-[rgb(var(--af-scan-rgb))]" />
            </label>
            <button type="button" onClick={() => { setRotate((r) => (r + 90) % 360); setOff({ x: 0, y: 0 }); }} className="btn btn-ghost btn-sm min-h-[40px]"><RotateCw className="h-4 w-4" aria-hidden="true" />Rotate</button>
          </div>
          <div className="flex items-center gap-3" aria-label="Preview">
            <canvas ref={bigRef} aria-hidden="true" className={cn("border-2 border-ink bg-white", shape === "circle" ? "h-[96px] w-[96px] rounded-full" : "h-auto w-[230px] rounded-lg")} />
            {shape === "circle" && <canvas ref={smallRef} aria-hidden="true" className="h-10 w-10 rounded-full border-2 border-ink bg-white" />}
            <span className="text-[13px] text-ink-2">How it looks on your page</span>
          </div>
          {error && <Problem tone="error" title={error} fix={{ label: "Try again", onClick: save }} />}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={saving}>Cancel</button>
          {changed && <button type="button" onClick={() => { setRotate(0); setZoom(1); setOff({ x: 0, y: 0 }); }} className="btn btn-ghost" disabled={saving}>Reset</button>}
          <button type="button" onClick={save} className="btn btn-blue ml-auto min-w-[120px]" disabled={!img || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </EditorDialog>
  );
}
