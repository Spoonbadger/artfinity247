// Photo edits for artwork uploads (client- and server-safe, no DB).
//
// The editor (components/media/ImageEditor.tsx) never uploads pixels. It sends these parameters to
// POST /api/uploads/edit, which applies them with sharp to the full-resolution private original
// (lib/imageEdits.server.ts) and stores the result through the normal upload pipeline.
//
// Order, each step working on the result of the one before:
//   1. rotate   quarter turns clockwise (0/90/180/270) of the upright original
//   2. corners  "Fix angle": the painting's 4 corners (TL, TR, BR, BL), normalized 0..1 in the rotated image,
//               flattened to a rectangle (homography from lib/scenes/geometry.ts)
//   3. angle    straighten, degrees clockwise (±10); the frame zooms in so no empty corners show
//   4. crop     normalized rect 0..1 of the image after steps 1-3
// All of it folds into one 3×3 matrix (output px -> original px), so the server resamples the original once.
import { apply, homography, invert, mul, type M3, type P } from "@/lib/scenes/geometry";
import { printableFor } from "@/lib/printSizes";
import { SIZE_INCHES, type SizeKey } from "@/lib/earnings";

export type Pt = [number, number];
export type Quad = [Pt, Pt, Pt, Pt];
export type Rect = { x: number; y: number; w: number; h: number };
export type Turn = 0 | 90 | 180 | 270;

export type ImageEdits = {
  rotate: Turn;
  corners: Quad | null;
  /** Width / height the flattened painting should have (from its real size); null = measured from the corners. */
  aspect: number | null;
  angle: number;
  crop: Rect | null;
};

/** What an artwork stores (Artwork.imageEdits): the edits plus the untouched upload they were applied to. */
export type StoredEdits = ImageEdits & { v: 1; source: string; sourceW: number; sourceH: number };

export const MAX_ANGLE = 10;
export const NO_EDITS: ImageEdits = { rotate: 0, corners: null, aspect: null, angle: 0, crop: null };
export const FULL: Rect = { x: 0, y: 0, w: 1, h: 1 };

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** True when the edits change nothing. */
export function isIdentity(e: ImageEdits): boolean {
  const c = e.crop;
  const fullCrop = !c || (c.x <= 0.0005 && c.y <= 0.0005 && c.w >= 0.999 && c.h >= 0.999);
  return e.rotate === 0 && !e.corners && Math.abs(e.angle) < 0.01 && fullCrop;
}

/** Validates edits from a request or the database. null = not valid. */
export function parseEdits(raw: unknown): ImageEdits | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rotate = Number(r.rotate ?? 0);
  if (![0, 90, 180, 270].includes(rotate)) return null;
  const angle = Number(r.angle ?? 0);
  if (!Number.isFinite(angle) || Math.abs(angle) > MAX_ANGLE + 1e-9) return null;
  let corners: Quad | null = null;
  if (r.corners != null) {
    if (!Array.isArray(r.corners) || r.corners.length !== 4) return null;
    const pts = r.corners.map((p) => (Array.isArray(p) && p.length === 2 && finite(p[0]) && finite(p[1]) ? ([clamp(p[0], -0.05, 1.05), clamp(p[1], -0.05, 1.05)] as Pt) : null));
    if (pts.some((p) => !p)) return null;
    corners = pts as Quad;
    if (!convex(corners) || quadArea(corners) < 0.01) return null;
  }
  let aspect: number | null = null;
  if (r.aspect != null) {
    if (!finite(r.aspect) || r.aspect < 0.1 || r.aspect > 10) return null;
    aspect = r.aspect;
  }
  let crop: Rect | null = null;
  if (r.crop != null) {
    const c = r.crop as Record<string, unknown>;
    if (![c.x, c.y, c.w, c.h].every(finite)) return null;
    const x = clamp(c.x as number, 0, 1), y = clamp(c.y as number, 0, 1);
    const w = clamp(c.w as number, 0, 1 - x), h = clamp(c.h as number, 0, 1 - y);
    if (w < 0.02 || h < 0.02) return null;
    crop = { x, y, w, h };
  }
  return { rotate: rotate as Turn, corners, aspect: corners ? aspect : null, angle, crop };
}

/** Stored edits from Artwork.imageEdits, or null. */
export function parseStored(raw: unknown): StoredEdits | null {
  const e = parseEdits(raw);
  const r = raw as Record<string, unknown> | null;
  if (!e || !r || typeof r.source !== "string" || !r.source) return null;
  return { ...e, v: 1, source: r.source, sourceW: Number(r.sourceW) || 0, sourceH: Number(r.sourceH) || 0 };
}

export function quadArea(q: Quad): number {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = q[i], [x2, y2] = q[(i + 1) % 4];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** Corners in order with no crossing edges. */
export function convex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i], [bx, by] = q[(i + 1) % 4], [cx, cy] = q[(i + 2) % 4];
    const z = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(z) < 1e-9) return false;
    const s = Math.sign(z);
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}

export const turned = (w: number, h: number, r: Turn) => (r === 90 || r === 270 ? { w: h, h: w } : { w, h });

/** Rotated-image px -> original px (both continuous, origin top-left), for a quarter turn clockwise. */
function unturn(W: number, H: number, r: Turn): M3 {
  if (r === 90) return [0, 1, 0, -1, 0, H, 0, 0, 1];
  if (r === 180) return [-1, 0, W, 0, -1, H, 0, 0, 1];
  if (r === 270) return [0, -1, W, 1, 0, 0, 0, 0, 1];
  return [1, 0, 0, 0, 1, 0, 0, 0, 1];
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Size of the flattened painting in px: average opposite edges, or the given shape at the same area. */
export function flatSize(q: Quad, w: number, h: number, aspect: number | null) {
  const px = q.map(([x, y]) => [x * w, y * h] as Pt);
  const fw = (dist(px[0], px[1]) + dist(px[3], px[2])) / 2;
  const fh = (dist(px[0], px[3]) + dist(px[1], px[2])) / 2;
  if (!aspect) return { w: Math.max(1, fw), h: Math.max(1, fh) };
  const area = fw * fh;
  return { w: Math.max(1, Math.sqrt(area * aspect)), h: Math.max(1, Math.sqrt(area / aspect)) };
}

/** Straighten: how much the frame shrinks so a w×h image turned by `deg` leaves no empty corners. */
export function straightenScale(w: number, h: number, deg: number) {
  const t = (Math.abs(deg) * Math.PI) / 180;
  const c = Math.cos(t), s = Math.sin(t);
  return Math.min(w / (w * c + h * s), h / (w * s + h * c));
}

export type Stages = {
  /** After the quarter turn. */
  A: { w: number; h: number };
  /** After "Fix angle" (same as A without corners). */
  B: { w: number; h: number };
  /** After straightening: the image the crop is drawn on. */
  C: { w: number; h: number };
  /** B px -> A px (identity without corners). */
  BtoA: M3;
  /** C px -> B px. */
  CtoB: M3;
};

/** Sizes and maps of each step for an upright original of W×H px. */
export function stages(W: number, H: number, e: ImageEdits): Stages {
  const A = turned(W, H, e.rotate);
  let B = A;
  let BtoA: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  if (e.corners) {
    B = flatSize(e.corners, A.w, A.h, e.aspect);
    const dst = e.corners.map(([x, y]) => [x * A.w, y * A.h] as P);
    BtoA = homography([[0, 0], [B.w, 0], [B.w, B.h], [0, B.h]], dst);
  }
  const s = straightenScale(B.w, B.h, e.angle);
  const C = { w: B.w * s, h: B.h * s };
  // C px -> B px: about the centre, turn back by the straighten angle.
  const t = (-e.angle * Math.PI) / 180;
  const cos = Math.cos(t), sin = Math.sin(t);
  const CtoB = mul([1, 0, B.w / 2, 0, 1, B.h / 2, 0, 0, 1], mul([cos, -sin, 0, sin, cos, 0, 0, 0, 1], [1, 0, -C.w / 2, 0, 1, -C.h / 2, 0, 0, 1]));
  return { A, B, C, BtoA, CtoB };
}

/** Output size and the single map output px -> original px for edits on a W×H upright original. */
export function editPlan(W: number, H: number, e: ImageEdits) {
  const st = stages(W, H, e);
  const c = e.crop ?? FULL;
  const outW = Math.max(1, Math.round(c.w * st.C.w));
  const outH = Math.max(1, Math.round(c.h * st.C.h));
  // output px -> C px (scale absorbs rounding so the crop edges land exactly)
  const OtoC: M3 = [(c.w * st.C.w) / outW, 0, c.x * st.C.w, 0, (c.h * st.C.h) / outH, c.y * st.C.h, 0, 0, 1];
  const M = mul(unturn(W, H, e.rotate), mul(st.BtoA, mul(st.CtoB, OtoC)));
  return { outW, outH, M, stages: st };
}

/** Pixel size after the edits, for print sizes before saving. */
export function editedSize(W: number, H: number, e: ImageEdits) {
  const { outW, outH } = editPlan(W, H, e);
  return { w: outW, h: outH };
}

/** A point of the crop image (C, normalized) in the original (normalized). For drawing the result on the original. */
export function cToOriginal(W: number, H: number, e: ImageEdits, p: Pt): Pt {
  const st = stages(W, H, e);
  const q = apply(mul(unturn(W, H, e.rotate), mul(st.BtoA, st.CtoB)), [p[0] * st.C.w, p[1] * st.C.h]);
  return [q[0] / W, q[1] / H];
}

export { invert, apply, mul, type M3 };

const SIZE_ORDER: SizeKey[] = ["small", "medium", "large", "xl"];
const largest = (sizes: SizeKey[]) => SIZE_ORDER.filter((s) => sizes.includes(s)).pop() ?? null;
const inches = (s: SizeKey) => SIZE_INCHES[s].replace(/\s*in$/, "").replace(/\s/g, "");

/**
 * What the edits do to print sizes, in one short line ("Cropping drops the largest print from 24×36 to 18×24.").
 * `tone` is "warn" when the largest size drops or nothing prints.
 */
export function printImpact(W: number, H: number, e: ImageEdits): { before: SizeKey[]; after: SizeKey[]; text: string; tone: "ok" | "warn" } {
  const before = printableFor(W, H) as SizeKey[];
  const sz = editedSize(W, H, e);
  const after = printableFor(sz.w, sz.h) as SizeKey[];
  const b = largest(before), a = largest(after);
  const verb = e.crop && !isIdentity({ ...NO_EDITS, crop: e.crop }) ? "Cropping" : "This edit";
  if (!a) return { before, after, text: b ? `${verb} makes it too small to print. Crop less.` : "Too small to print. Try a bigger photo.", tone: "warn" };
  if (b && a !== b) return { before, after, text: `${verb} drops the largest print from ${inches(b)} to ${inches(a)}.`, tone: "warn" };
  return { before, after, text: `Prints up to ${inches(a)} in.`, tone: "ok" };
}

/**
 * Inverse-maps every output pixel centre through M (output px -> source px) and samples the source bilinearly.
 * Outside the source: edge pixels repeat (the editor keeps the crop inside, so this only touches the last pixel row).
 * When the map shrinks the source a lot (a far-away painting in a big photo), 2×2 supersampling keeps it smooth.
 */
export function warp(src: Uint8Array | Uint8ClampedArray, sw: number, sh: number, ch: number, M: number[], ow: number, oh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(ow * oh * ch);
  // Local scale at the centre: source px per output px.
  const at = (x: number, y: number) => {
    const w = M[6] * x + M[7] * y + M[8];
    return [(M[0] * x + M[1] * y + M[2]) / w, (M[3] * x + M[4] * y + M[5]) / w];
  };
  const c0 = at(ow / 2, oh / 2), cx = at(ow / 2 + 1, oh / 2), cy = at(ow / 2, oh / 2 + 1);
  const scale = Math.max(Math.hypot(cx[0] - c0[0], cx[1] - c0[1]), Math.hypot(cy[0] - c0[0], cy[1] - c0[1]));
  const offs = scale > 1.6 ? [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]] : [[0, 0]];
  const k = 1 / offs.length;
  const acc = new Float64Array(ch);
  const maxX = sw - 1, maxY = sh - 1;
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      acc.fill(0);
      for (const [dx, dy] of offs) {
        const X = x + 0.5 + dx, Y = y + 0.5 + dy;
        const w = M[6] * X + M[7] * Y + M[8];
        let sx = (M[0] * X + M[1] * Y + M[2]) / w - 0.5;
        let sy = (M[3] * X + M[4] * Y + M[5]) / w - 0.5;
        if (sx < 0) sx = 0; else if (sx > maxX) sx = maxX;
        if (sy < 0) sy = 0; else if (sy > maxY) sy = maxY;
        const x0 = sx | 0, y0 = sy | 0;
        const x1 = x0 < maxX ? x0 + 1 : x0, y1 = y0 < maxY ? y0 + 1 : y0;
        const fx = sx - x0, fy = sy - y0;
        const i00 = (y0 * sw + x0) * ch, i10 = (y0 * sw + x1) * ch, i01 = (y1 * sw + x0) * ch, i11 = (y1 * sw + x1) * ch;
        const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
        for (let c = 0; c < ch; c++) acc[c] += src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11;
      }
      const o = (y * ow + x) * ch;
      for (let c = 0; c < ch; c++) out[o + c] = acc[c] * k; // clamped array: rounds and clamps
    }
  }
  return out;
}
