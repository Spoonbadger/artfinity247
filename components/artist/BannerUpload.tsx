"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { uploadImage, UploadFailed } from "@/components/media/uploadImage";
import { failed } from "@/lib/feedback";
import { cn } from "@/lib/utils";

export type UploadBanner = { kind: "upload"; url: string; x: number; y: number };

// The banner as the artist page draws it (components/artist/ArtistBanner.tsx and app/(landing)/artists/[slug]):
// 300px tall on a 1440px desktop and 168px on a 390px phone, with the avatar overlapping its bottom-left corner.
const FRAMES = {
  desktop: { w: 1440, h: 300, avatar: 144, left: 24, overlap: 64, edge: 38 },
  phone: { w: 390, h: 168, avatar: 96, left: 16, overlap: 48, edge: 26 },
} as const;

/** Picker tile for the banner row: upload a new image, or pick the one uploaded before. */
export function UploadTile({ url, on, busy, onPick, onFile }: { url: string | null; on: boolean; busy: number | null; onPick: () => void; onFile: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const file = <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />;
  if (url)
    return (
      <button
        type="button" role="radio" aria-checked={on} aria-label="Banner: your image" title="Your image" onClick={onPick}
        className={cn("relative h-[68px] w-[92px] shrink-0 overflow-hidden rounded-lg border-2", on ? "border-ink ring-2 ring-ink ring-offset-2" : "border-transparent hover:border-ink")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="h-full w-full object-cover" />
      </button>
    );
  return (
    <>
      <button
        type="button" onClick={() => input.current?.click()} disabled={busy !== null}
        className="grid h-[68px] w-[92px] shrink-0 place-items-center content-center gap-1 rounded-lg border-2 border-dashed border-edge-strong bg-white px-2 text-center text-[13px] font-bold leading-tight hover:border-ink disabled:opacity-70"
      >
        <ImagePlus className="h-5 w-5" aria-hidden="true" />
        {busy !== null ? `${Math.round(busy * 100)}%` : "Upload"}
      </button>
      {file}
    </>
  );
}

/** Upload with progress; resolves with the URL, or null when it failed (the toast says why). */
export function useBannerUpload() {
  const [busy, setBusy] = useState<number | null>(null);
  async function upload(file: File): Promise<string | null> {
    setBusy(0);
    try {
      const img = await uploadImage(file, { kind: "photo" }, { onProgress: setBusy });
      if (img.width && img.width < 1600) toast("This image is small, so it may look soft on large screens.");
      return img.url;
    } catch (e) {
      failed(e instanceof UploadFailed ? e.message : "Upload failed. Try again.");
      return null;
    } finally {
      setBusy(null);
    }
  }
  return { busy, upload };
}

/**
 * The chosen image with a focus point to drag, and how the banner crops on desktop and on a phone around it.
 * The white circle in each preview is where the profile photo sits.
 */
export function BannerFocus({ banner, onChange, onReplace, onRemove, busy }: {
  banner: UploadBanner;
  onChange: (b: UploadBanner) => void;
  onReplace: (f: File) => void;
  onRemove: () => void;
  busy: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const moveTo = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r?.width) return;
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)));
    if (x !== banner.x || y !== banner.y) onChange({ ...banner, x, y });
  };
  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    onChange({ ...banner, x: Math.min(100, Math.max(0, banner.x + d[0])), y: Math.min(100, Math.max(0, banner.y + d[1])) });
  };

  return (
    <div className="grid gap-3 rounded-xl border border-line bg-white p-3">
      <p className="text-[13px] font-semibold text-ink">Drag the dot to choose what stays in view</p>
      <div className="grid justify-items-center rounded-lg bg-wall p-2">
        <div
          ref={box}
          className="relative cursor-crosshair touch-none select-none"
          onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); moveTo(e); }}
          onPointerMove={(e) => dragging.current && moveTo(e)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner.url} alt="" draggable={false} className="block max-h-[200px] w-auto max-w-full rounded" />
          <button
            type="button"
            role="slider"
            aria-label="Focus point"
            aria-valuetext={`${banner.x}% across, ${banner.y}% down`}
            aria-valuenow={banner.x}
            onKeyDown={onKey}
            className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-scan/80 shadow-[0_0_0_1.5px_rgba(21,22,27,.6),0_4px_10px_rgba(21,22,27,.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            style={{ left: `${banner.x}%`, top: `${banner.y}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_150px] items-end gap-3">
        <Frame label="Desktop" frame={FRAMES.desktop} banner={banner} />
        <Frame label="Phone" frame={FRAMES.phone} banner={banner} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={busy !== null} className="btn btn-ghost btn-sm min-h-[40px] px-4">
          {busy !== null ? `Uploading ${Math.round(busy * 100)}%` : "Replace image"}
        </button>
        <button type="button" onClick={onRemove} className="btn btn-ghost btn-sm min-h-[40px] px-4">Remove</button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onReplace(f); }} />
      </div>
    </div>
  );
}

/** One crop preview at the page's real proportions, with the avatar and the brushed bottom edge where they fall. */
function Frame({ label, frame, banner }: { label: string; frame: (typeof FRAMES)[keyof typeof FRAMES]; banner: UploadBanner }) {
  const pctW = (px: number) => `${(px / frame.w) * 100}%`;
  // the avatar overlaps the banner by `overlap` and hangs below it by the rest of its height
  const below = frame.avatar - frame.overlap;
  const total = frame.h + below;
  return (
    <figure className="grid min-w-0 gap-1.5">
      <div className="relative overflow-hidden rounded-md border border-line bg-wall" style={{ aspectRatio: `${frame.w} / ${total}` }}>
        <div
          className="absolute inset-x-0 top-0 bg-cover"
          style={{ height: `${(frame.h / total) * 100}%`, backgroundImage: `url("${banner.url}")`, backgroundPosition: `${banner.x}% ${banner.y}%` }}
        />
        {/* the brushed edge fades the banner's last strip into the page */}
        <div
          className="absolute inset-x-0 bg-gradient-to-b from-transparent to-white"
          style={{ top: `${((frame.h - frame.edge) / total) * 100}%`, height: `${(frame.edge / total) * 100}%` }}
        />
        <div className="absolute inset-x-0 bottom-0 bg-white" style={{ height: `${(below / total) * 100}%` }} />
        <span
          aria-hidden="true"
          className="absolute bottom-0 aspect-square rounded-full border-2 border-white bg-[#d9d4cc] shadow-[0_2px_6px_rgba(21,22,27,.25)]"
          style={{ left: pctW(frame.left), width: pctW(frame.avatar) }}
        />
      </div>
      <figcaption className="text-[12px] font-semibold text-ink-2">{label}</figcaption>
    </figure>
  );
}
