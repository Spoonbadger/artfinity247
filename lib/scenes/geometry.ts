// Photo scenes: plane geometry (client- and server-safe).
// A wall is a plane; a picture of it is a homography. From the clicked wall quad and one reference line we recover
// a metric map G: wall inches -> image pixels, so a print of a given size lands at true scale and in perspective.
import { printBox } from "@/lib/rooms/scene";
import type { PrintSizeKey, SceneAnnotation } from "./types";

export type P = [number, number];
/** 3×3 matrix, row-major. */
export type M3 = number[];

/** Solves the 3×3 homography that maps src[i] -> dst[i] (4 point pairs). */
export function homography(src: P[], dst: P[]): M3 {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting on the 8×9 augmented system
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    const d = A[c][c];
    if (Math.abs(d) < 1e-12) throw new Error("Degenerate quad");
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const m = A[r][c];
      if (m) for (let k = c; k < 9; k++) A[r][k] -= m * A[c][k];
    }
  }
  return [A[0][8], A[1][8], A[2][8], A[3][8], A[4][8], A[5][8], A[6][8], A[7][8], 1];
}

export function apply(H: M3, p: P): P {
  const w = H[6] * p[0] + H[7] * p[1] + H[8];
  return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w];
}

export function mul(A: M3, B: M3): M3 {
  const o: M3 = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += A[r * 3 + k] * B[k * 3 + c];
  return o;
}

export function invert(m: M3): M3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-18) throw new Error("Singular matrix");
  const inv = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d];
  return inv.map((v) => v / det);
}

/** CSS matrix3d() that maps an element of size w×h (origin top-left) onto a quad (TL, TR, BR, BL). */
export function cssMatrix3d(w: number, h: number, quad: P[]): string {
  const H = homography([[0, 0], [w, 0], [w, h], [0, h]], quad);
  const m = [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, H[8]];
  return `matrix3d(${m.map((v) => +v.toFixed(10)).join(",")})`;
}

/** Puts 4 clicked points in TL, TR, BR, BL order. */
export function orderQuad(pts: P[]): [P, P, P, P] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / 4;
  const cy = pts.reduce((s, p) => s + p[1], 0) / 4;
  const s = pts.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  // atan2 order from -π: TL, TR, BR, BL (image y points down)
  let start = 0;
  let best = Infinity;
  s.forEach((p, i) => {
    const v = p[0] + p[1];
    if (v < best) (best = v), (start = i);
  });
  const o = [0, 1, 2, 3].map((k) => s[(start + k) % 4]);
  return [o[0], o[1], o[2], o[3]];
}

export function pointInQuad(p: P, q: P[]): boolean {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i];
    const [xj, yj] = q[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const UNIT: P[] = [[0, 0], [1, 0], [1, 1], [0, 1]];
/** Default lens when the photo has too little perspective to measure one: 28mm (35mm equivalent), a typical interior shot. */
export const DEFAULT_LENS_MM = 28;

export type WallSolve = {
  /** wall inches (X right, Y down, origin at the quad's top-left) -> image px */
  G: M3;
  Ginv: M3;
  wallIn: { w: number; h: number };
  focal: number;
  focalSource: "perspective" | "lens" | "assumed" | "frontal" | "ref2";
};

/**
 * Metric wall plane from the quad + reference line.
 * 1. H maps the unit square to the quad.
 * 2. The quad is a real rectangle, so its two edge directions are perpendicular in 3D. With the principal point at the
 *    image center and square pixels, that fixes the focal length (when both vanishing points are finite), and with it
 *    the rectangle's true aspect ratio. Otherwise we use the given or a default lens.
 * 3. The reference line, mapped back onto the plane, fixes the absolute scale.
 */
export function solveWall(a: Pick<SceneAnnotation, "image" | "quad" | "ref" | "lens" | "ref2">): WallSolve | null {
  const { w, h } = a.image;
  if (!a.quad || a.quad.length !== 4 || !a.ref || !(a.ref.inches > 0)) return null;
  let H: M3;
  try {
    H = homography(UNIT, a.quad);
  } catch {
    return null;
  }
  const cx = w / 2, cy = h / 2;
  const Hc = mul([1, 0, -cx, 0, 1, -cy, 0, 0, 1], H);
  const [a1, b1, c1] = [Hc[0], Hc[3], Hc[6]];
  const [a2, b2, c2] = [Hc[1], Hc[4], Hc[7]];
  const diag = Math.hypot(w, h);
  const long = Math.max(w, h);

  // vanishing points (distance from center, in multiples of the long side); finite when |c| is large enough
  const vp = (a: number, b: number, c: number) => (Math.abs(c) < 1e-15 ? Infinity : Math.hypot(a / c, b / c) / long);
  const v1 = vp(a1, b1, c1), v2 = vp(a2, b2, c2);
  let f = 0;
  let focalSource: WallSolve["focalSource"] = "assumed";
  if (v1 < 12 && v2 < 12) {
    const f2 = -(a1 * a2 + b1 * b2) / (c1 * c2);
    if (f2 > 0 && Math.sqrt(f2) > 0.3 * long && Math.sqrt(f2) < 5 * long) (f = Math.sqrt(f2)), (focalSource = "perspective");
  }
  if (!f) {
    if (a.lens && a.lens > 5) (f = (a.lens * diag) / 43.27), (focalSource = "lens");
    else f = (DEFAULT_LENS_MM * diag) / 43.27;
    if (v1 > 40 && v2 > 40) focalSource = "frontal"; // (near) parallel edges: the lens hardly matters
  }
  // true aspect ratio W/H of the wall rectangle
  const n1 = Math.hypot(a1 / f, b1 / f, c1);
  const n2 = Math.hypot(a2 / f, b2 / f, c2);
  let aspect = n1 / n2;

  // reference line in unit-square coordinates
  let Hi: M3;
  try {
    Hi = invert(H);
  } catch {
    return null;
  }
  const ua = apply(Hi, a.ref.a), ub = apply(Hi, a.ref.b);
  // A second, roughly horizontal reference on the wall (e.g. a door's width) measures the aspect directly:
  // d1²/d2² = ((Δu1·A)² + Δv1²) / ((Δu2·A)² + Δv2²)  ->  A² = (r·Δv2² − Δv1²) / (Δu1² − r·Δu2²)
  if (a.ref2 && a.ref2.inches > 0) {
    const pa = apply(Hi, a.ref2.a), pb = apply(Hi, a.ref2.b);
    const du1 = ub[0] - ua[0], dv1 = ub[1] - ua[1], du2 = pb[0] - pa[0], dv2 = pb[1] - pa[1];
    const r = (a.ref.inches / a.ref2.inches) ** 2;
    const den = du1 * du1 - r * du2 * du2;
    const A2 = Math.abs(den) > 1e-12 ? (r * dv2 * dv2 - dv1 * dv1) / den : -1;
    if (A2 > 0 && Math.sqrt(A2) > aspect / 6 && Math.sqrt(A2) < aspect * 6) (aspect = Math.sqrt(A2)), (focalSource = "ref2");
  }
  const unitLen = Math.hypot((ub[0] - ua[0]) * aspect, ub[1] - ua[1]);
  if (!(unitLen > 1e-6)) return null;
  const Hin = a.ref.inches / unitLen;
  const Win = aspect * Hin;
  const G = mul(H, [1 / Win, 0, 0, 0, 1 / Hin, 0, 0, 0, 1]);
  return { G, Ginv: invert(G), wallIn: { w: Win, h: Hin }, focal: f, focalSource };
}

/** Pixels per inch on the wall at an image point (geometric mean of the two local scales). */
export function ppiAt(s: WallSolve, p: P) {
  const q = apply(s.Ginv, p);
  const dx = Math.hypot(...sub(apply(s.G, [q[0] + 0.5, q[1]]), apply(s.G, [q[0] - 0.5, q[1]])));
  const dy = Math.hypot(...sub(apply(s.G, [q[0], q[1] + 0.5]), apply(s.G, [q[0], q[1] - 0.5])));
  return { x: dx, y: dy, ppi: Math.sqrt(dx * dy) };
}
const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1]];

/** The framed outline (inches) for a size, image aspect, frame and mat. Same numbers as the procedural rooms. */
export function frameBox(size: PrintSizeKey, artAspect: number, frame: string | null | undefined, mat = true) {
  return printBox(size, artAspect, frame && frame !== "none" ? (frame as "black") : null, mat);
}

/** Corners (TL, TR, BR, BL) of a framed print centered at a wall point, in wall inches. */
export function boxOnWall(center: P, W: number, H: number): P[] {
  return [[center[0] - W / 2, center[1] - H / 2], [center[0] + W / 2, center[1] - H / 2], [center[0] + W / 2, center[1] + H / 2], [center[0] - W / 2, center[1] + H / 2]];
}

/** Sizes whose framed outline (portrait and landscape, with mat) fits inside the wall quad around the anchor. */
export function usableSizes(s: WallSolve, anchor: P): PrintSizeKey[] {
  const c = apply(s.Ginv, anchor);
  const sizes: PrintSizeKey[] = ["small", "medium", "large", "xl"];
  return sizes.filter((k) => {
    const b = frameBox(k, 0.8, "black", true);
    const side = Math.max(b.W, b.H);
    return c[0] - side / 2 >= -0.01 && c[0] + side / 2 <= s.wallIn.w + 0.01 && c[1] - side / 2 >= -0.01 && c[1] + side / 2 <= s.wallIn.h + 0.01;
  });
}

/** Everything derived from an annotation, as stored in `computed`. */
export function computeAnnotation(a: SceneAnnotation): SceneAnnotation["computed"] | undefined {
  const s = solveWall(a);
  if (!s || !a.anchors?.length) return undefined;
  const r = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  return {
    ppi: r(ppiAt(s, a.anchors[0]).ppi, 3),
    wallIn: { w: r(s.wallIn.w, 1), h: r(s.wallIn.h, 1) },
    focal: Math.round(s.focal),
    focalSource: s.focalSource,
    usableSizes: usableSizes(s, a.anchors[0]),
  };
}

export const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [235, 232, 226];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const rgbToHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
