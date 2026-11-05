"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut } from "lucide-react";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

const MAX = 5;

/**
 * Fullscreen viewer for the painting: pinch or scroll to zoom, drag to pan, double-tap to
 * toggle 2.5×, Esc or × to close. Plain pointer events, no dependency.
 */
export default function ArtZoom({ open, onClose, src, alt }: { open: boolean; onClose: () => void; src: string; alt: string }) {
  const [t, setT] = useState({ s: 1, x: 0, y: 0 });
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; s: number } | null>(null);
  const lastTap = useRef(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open, { restoreFocus: false }); // the effect below returns focus to the opener

  const zoomTo = useCallback((s: number) => setT((o) => {
    const ns = Math.max(1, Math.min(MAX, s));
    return ns === 1 ? { s: 1, x: 0, y: 0 } : { s: ns, x: (o.x * ns) / o.s, y: (o.y * ns) / o.s };
  }), []);

  useEffect(() => {
    if (!open) return;
    setT({ s: 1, x: 0, y: 0 });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") setT((o) => ({ ...o, s: Math.min(MAX, o.s * 1.4) }));
      if (e.key === "-") zoomTo(0);
      // Arrow keys pan a zoomed painting (keyboard version of dragging).
      const pan = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] }[e.key];
      if (pan) {
        e.preventDefault();
        setT((o) => (o.s > 1 ? { ...o, x: o.x + pan[0], y: o.y + pan[1] } : o));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); opener?.focus?.(); };
  }, [open, onClose, zoomTo]);

  if (!open) return null;

  const dist = () => {
    const [a, b] = Array.from(pts.current.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${alt}, zoomed`}
      className="fixed inset-0 z-[80] touch-none select-none bg-[#15161b]/95"
      onWheel={(e) => setT((o) => {
        const ns = Math.max(1, Math.min(MAX, o.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        return ns === 1 ? { s: 1, x: 0, y: 0 } : { ...o, s: ns };
      })}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.current.size === 2) pinch.current = { d: dist(), s: t.s };
        if (pts.current.size === 1) {
          const now = Date.now();
          if (now - lastTap.current < 300) zoomTo(t.s > 1 ? 1 : 2.5);
          lastTap.current = now;
        }
      }}
      onPointerMove={(e) => {
        const p = pts.current.get(e.pointerId);
        if (!p) return;
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.current.size === 2 && pinch.current) {
          const ns = Math.max(1, Math.min(MAX, (pinch.current.s * dist()) / pinch.current.d));
          setT((o) => (ns === 1 ? { s: 1, x: 0, y: 0 } : { ...o, s: ns }));
        } else if (pts.current.size === 1) {
          setT((o) => (o.s > 1 ? { ...o, x: o.x + dx, y: o.y + dy } : o));
        }
      }}
      onPointerUp={(e) => { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = null; }}
      onPointerCancel={(e) => { pts.current.delete(e.pointerId); pinch.current = null; }}
    >
      <div className="grid h-full w-full place-items-center overflow-hidden p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-full max-w-full bg-white object-contain shadow-[0_20px_60px_rgba(0,0,0,.5)]"
          style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.s})`, transition: pts.current.size ? "none" : "transform 160ms ease-out", cursor: t.s > 1 ? "grab" : "zoom-in" }}
        />
      </div>
      <div className="absolute right-3 top-3 flex gap-2" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomTo(t.s * 1.5)} className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-ink hover:bg-white focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan" aria-label="Zoom in" title="Zoom in">
          <ZoomIn className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" onClick={() => zoomTo(t.s / 1.5)} disabled={t.s <= 1} className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-ink hover:bg-white disabled:opacity-40 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan" aria-label="Zoom out" title="Zoom out">
          <ZoomOut className="h-5 w-5" aria-hidden />
        </button>
        <button ref={closeRef} type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-white text-ink focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan" aria-label="Close" title="Close">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[13px] text-white/70">Pinch or scroll to zoom · arrow keys move · Esc to close</p>
    </div>
  );
}
