// Photo scenes: deterministic variants per base photo, and the map from scene numbers 0–999 to variants.
// Client- and server-safe.
import { apply, boxOnWall, frameBox, type P, type WallSolve } from "./geometry";
import type { Grade, SceneAnnotation } from "./types";

export const SCENE_SLOTS = 1000;
/** Every photo variant renders at 5:4, like the procedural rooms, so carousels and tiles keep one shape. */
export const OUT_ASPECT = 5 / 4;
const ZOOMS = [1, 0.8, 0.66];
const MAX_CROPS = 3;
const ALT_GRADES: Grade[] = ["w", "c", "e"];

export type CropRect = { x: number; y: number; w: number; h: number };
export type VariantSpec = { id: string; photo: number; anchor: number; crop: CropRect; mirror: boolean; grade: Grade };

export function hash32(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const bbox = (pts: P[]): Box => ({
  x0: Math.min(...pts.map((p) => p[0])),
  y0: Math.min(...pts.map((p) => p[1])),
  x1: Math.max(...pts.map((p) => p[0])),
  y1: Math.max(...pts.map((p) => p[1])),
});
const union = (a: Box, b: Box): Box => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
const iou = (a: CropRect, b: CropRect) => {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const i = ix * iy;
  return i / (a.w * a.h + b.w * b.h - i);
};
const clamp = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));

/**
 * Up to 3 crops (5:4) around one anchor: the widest view, then tighter ones. Each keeps the largest (XL, framed) print
 * in frame, and the reference object too when it fits, so there is always something to judge size by.
 */
export function cropsFor(ann: SceneAnnotation, s: WallSolve, anchorIdx: number): CropRect[] {
  const { w: W, h: H } = ann.image;
  const anchor = ann.anchors[anchorIdx] ?? ann.anchors[0];
  const c = apply(s.Ginv, anchor);
  const xl = frameBox("xl", 0.8, "black", true);
  const side = Math.max(xl.W, xl.H) + 6; // the biggest print either way up, plus a little wall
  const art = bbox(boxOnWall(c, side, side).map((p) => apply(s.G, p)));
  const refLen = Math.hypot(ann.ref.b[0] - ann.ref.a[0], ann.ref.b[1] - ann.ref.a[1]);
  const ref = bbox([ann.ref.a, ann.ref.b]);
  const refBox: Box = { x0: ref.x0 - refLen * 0.12, y0: ref.y0 - refLen * 0.1, x1: ref.x1 + refLen * 0.12, y1: ref.y1 + refLen * 0.04 };
  const both = union(art, refBox);
  const maxW = Math.min(W, H * OUT_ASPECT);
  const out: CropRect[] = [];
  const place = (cw: number, ch: number, t: Box, bias = 0.5): CropRect => {
    const prefX = (art.x0 + art.x1) / 2 - cw / 2;
    const prefY = (art.y0 + art.y1) / 2 - ch * 0.46;
    const lo = Math.max(0, t.x1 - cw), hi = Math.min(W - cw, t.x0);
    const x = bias === 0.5 ? clamp(prefX, lo, hi) : clamp(lo + (hi - lo) * bias, lo, hi);
    const y = clamp(prefY, Math.max(0, t.y1 - ch), Math.min(H - ch, t.y0));
    return { x: Math.round(clamp(x, 0, W - cw)), y: Math.round(clamp(y, 0, H - ch)), w: Math.round(cw), h: Math.round(ch) };
  };
  const fits = (cw: number, ch: number, t: Box) => t.x1 - t.x0 <= cw * 0.96 && t.y1 - t.y0 <= ch * 0.96;
  for (const z of ZOOMS) {
    const cw = maxW * z, ch = cw / OUT_ASPECT;
    if (art.x1 - art.x0 > cw * 0.9 || art.y1 - art.y0 > ch * 0.9) continue; // too tight for an XL print
    const t = fits(cw, ch, both) ? both : art;
    const r = place(cw, ch, t);
    if (!out.some((o) => iou(o, r) > 0.86)) out.push(r);
  }
  // not enough distinct zooms: slide the widest view left and right instead
  for (const bias of [0.15, 0.85]) {
    if (out.length >= MAX_CROPS) break;
    const cw = maxW, ch = cw / OUT_ASPECT;
    const r = place(cw, ch, fits(cw, ch, both) ? both : art, bias);
    if (!out.some((o) => iou(o, r) > 0.86)) out.push(r);
  }
  if (!out.length) out.push({ x: Math.round((W - maxW) / 2), y: Math.round((H - maxW / OUT_ASPECT) / 2), w: Math.round(maxW), h: Math.round(maxW / OUT_ASPECT) });
  return out.slice(0, MAX_CROPS);
}

/**
 * Variants of one photo in a fixed order: neutral grade first (every anchor × crop × mirror), then one alternate grade
 * (warm, cool or evening, chosen per variant). Typically 3 crops × 2 mirrors × 2 grades = 12 per anchor.
 */
export function variantsFor(photo: number, photoId: string, crops: CropRect[][], mirrorOk: boolean): VariantSpec[] {
  const out: VariantSpec[] = [];
  const mirrors = mirrorOk ? [false, true] : [false];
  for (const pass of [0, 1]) {
    crops.forEach((list, a) =>
      list.forEach((crop, c) =>
        mirrors.forEach((mirror) => {
          const grade: Grade = pass === 0 ? "n" : ALT_GRADES[hash32(`${photoId}:${a}:${c}:${mirror ? 1 : 0}`) % 3];
          out.push({ id: `${photoId}~a${a}c${c}${mirror ? "m" : ""}${grade}`, photo, anchor: a, crop, mirror, grade });
        }),
      ),
    );
  }
  return out;
}

/**
 * Scene number -> variant. Round-robin across photos so the first numbers are all different photos.
 * Stable: a number that showed a distinct variant last build keeps it while that variant exists, so artists' saved
 * picks don't jump when photos are added. With fewer than 1,000 variants the rest repeat (marked).
 */
export function assignSlots(perPhoto: string[][], prev?: { slots: string[]; repeat: boolean[] } | null) {
  const order: string[] = [];
  const longest = Math.max(0, ...perPhoto.map((l) => l.length));
  for (let k = 0; k < longest; k++) for (const list of perPhoto) if (k < list.length) order.push(list[k]);
  const exists = new Set(order);
  const slots: (string | null)[] = new Array(SCENE_SLOTS).fill(null);
  const used = new Set<string>();
  if (prev?.slots?.length) {
    prev.slots.forEach((v, i) => {
      if (i < SCENE_SLOTS && v && !prev.repeat?.[i] && exists.has(v) && !used.has(v)) (slots[i] = v), used.add(v);
    });
  }
  const queue = order.filter((v) => !used.has(v));
  let q = 0;
  for (let i = 0; i < SCENE_SLOTS && q < queue.length; i++) if (!slots[i]) (slots[i] = queue[q++]), used.add(slots[i]!);
  const repeat = slots.map((v) => !v);
  const distinct = used.size;
  if (order.length) {
    // wrap: fill the remaining numbers with repeats, in the same round-robin order
    let k = 0;
    for (let i = 0; i < SCENE_SLOTS; i++) if (!slots[i]) slots[i] = order[k++ % order.length];
  }
  return { slots: slots as string[], repeat, distinct, unplaced: queue.length - q };
}
