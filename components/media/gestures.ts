"use client";
// Touch, pen and mouse gestures for the photo editors: one-finger drag, two-finger pinch + pan, and the scroll wheel.
// Coordinates are px relative to the element. The element needs `touch-action: none`.
import { useEffect, useRef, type RefObject } from "react";

export type XY = { x: number; y: number };
export type GestureHandlers = {
  /** A single pointer went down. Return what it drags (a handle id, "pan", ...), or null to ignore it. */
  start?: (p: XY, e: PointerEvent) => string | null;
  /** The dragged pointer moved by (dx, dy) to p. */
  move?: (kind: string, p: XY, d: XY) => void;
  end?: (kind: string) => void;
  /** Pinch or wheel: scale by `factor` around `center`, then move by `pan` (two-finger drag). */
  zoom?: (factor: number, center: XY, pan: XY) => void;
};

export function useGestures(ref: RefObject<HTMLElement>, handlers: GestureHandlers) {
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pts = new Map<number, XY>();
    let drag: { id: number; kind: string; last: XY } | null = null;
    let pinch: { dist: number; mid: XY } | null = null;

    const rel = (e: { clientX: number; clientY: number }): XY => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const pair = () => {
      const [a, b] = [...pts.values()];
      return { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    };
    const stopDrag = () => {
      if (drag) h.current.end?.(drag.kind);
      drag = null;
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const p = rel(e);
      pts.set(e.pointerId, p);
      try { el.setPointerCapture(e.pointerId); } catch {}
      if (pts.size === 2) {
        stopDrag();
        pinch = pair();
        return;
      }
      if (pts.size > 2) return;
      const kind = h.current.start?.(p, e) ?? null;
      if (kind) {
        drag = { id: e.pointerId, kind, last: p };
        e.preventDefault();
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const p = rel(e);
      pts.set(e.pointerId, p);
      if (pinch && pts.size === 2) {
        const now = pair();
        h.current.zoom?.(now.dist / pinch.dist, now.mid, { x: now.mid.x - pinch.mid.x, y: now.mid.y - pinch.mid.y });
        pinch = now;
        return;
      }
      if (drag && drag.id === e.pointerId) {
        const d = { x: p.x - drag.last.x, y: p.y - drag.last.y };
        drag.last = p;
        h.current.move?.(drag.kind, p, d);
      }
    };
    const up = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch {}
      if (drag?.id === e.pointerId) stopDrag();
      if (pts.size < 2) pinch = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!h.current.zoom) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      h.current.zoom(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), rel(e), { x: 0, y: 0 });
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [ref]);
}

/** Watches an element's size. */
export function useSize(ref: RefObject<HTMLElement>, onSize: (w: number, h: number) => void) {
  const cb = useRef(onSize);
  cb.current = onSize;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => cb.current(el.clientWidth, el.clientHeight));
    ro.observe(el);
    cb.current(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, [ref]);
}

/** Loads an image for canvas work (CORS-clean when the host allows it). */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src) && !src.startsWith(window.location.origin)) img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load"));
    img.src = src;
  });
}
