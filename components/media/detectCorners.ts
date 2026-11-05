// Guesses where a painting's corners are in a photo, to pre-place the "Fix angle" handles. Client-side, pure.
//
// Heuristic: the photo's border is mostly wall. Fit the wall colour (allowing a linear light falloff) to the border,
// flood the wall in from the edges through pixels close to that fit, and treat what the flood can't reach as the
// painting (holes filled). The corners are the extreme points of the largest such blob
// (min x+y, max x−y, max x+y, max y−x). The guess is thrown away unless the blob matches that four-sided shape almost
// exactly (straight edges, no gaps), sits inside the photo, and isn't just the whole photo. Returns normalized TL, TR, BR, BL or null.
import { convex, quadArea, type Quad } from "@/lib/imageEdits";

const SIDE = 256;

export function detectCorners(source: CanvasImageSource, sw: number, sh: number): Quad | null {
  try {
    const k = SIDE / Math.max(sw, sh);
    const w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;
    return cornersFromPixels(px, w, h);
  } catch {
    return null; // tainted canvas or no 2D context: no guess
  }
}

export function cornersFromPixels(px: Uint8ClampedArray, w: number, h: number): Quad | null {
  const n = w * h;
  // The wall: a colour that drifts linearly across the photo (light falloff), fitted per channel to a 2px border
  // ring by least squares: c(x, y) = a + b·x + c·y.
  const ring: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x <= 1 || y <= 1 || x >= w - 2 || y >= h - 2) ring.push(y * w + x);
  const S = [0, 0, 0, 0, 0, 0]; // n, Σx, Σy, Σxx, Σxy, Σyy
  const T = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]; // per channel: Σv, Σxv, Σyv
  for (const j of ring) {
    const x = j % w, y = (j / w) | 0;
    S[0]++; S[1] += x; S[2] += y; S[3] += x * x; S[4] += x * y; S[5] += y * y;
    for (let c = 0; c < 3; c++) { const v = px[j * 4 + c]; T[c][0] += v; T[c][1] += x * v; T[c][2] += y * v; }
  }
  const plane = T.map((t) => solve3([[S[0], S[1], S[2]], [S[1], S[3], S[4]], [S[2], S[4], S[5]]], t));
  if (plane.some((p) => !p)) return null;
  const d = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    const x = j % w, y = (j / w) | 0, i = j * 4;
    let s2 = 0;
    for (let c = 0; c < 3; c++) { const [a, b, cc] = plane[c]!; const r = px[i + c] - (a + b * x + cc * y); s2 += r * r; }
    d[j] = Math.sqrt(s2);
  }
  // How well the wall fits (95th percentile of the border's leftovers). A busy border (the painting fills the photo,
  // a patterned wall) gives no reliable background: no guess.
  const ringD = ring.map((j) => d[j]).sort((a, b) => a - b);
  const p95 = ringD[Math.floor(ringD.length * 0.95)];
  if (p95 > 45) return null;
  const thr = Math.max(20, p95 * 1.6 + 6);

  // Flood the wall in from the border; whatever it can't reach is the painting (holes filled).
  const bg = new Uint8Array(n);
  const stack: number[] = [];
  const push = (j: number) => { if (!bg[j] && d[j] <= thr) { bg[j] = 1; stack.push(j); } };
  for (const j of ring) push(j);
  while (stack.length) {
    const j = stack.pop()!;
    const x = j % w, y = (j / w) | 0;
    if (x > 0) push(j - 1);
    if (x < w - 1) push(j + 1);
    if (y > 0) push(j - w);
    if (y < h - 1) push(j + w);
  }

  // largest blob the flood didn't reach
  const seen = new Uint8Array(n);
  let bestBlob: number[] = [];
  for (let s = 0; s < n; s++) {
    if (bg[s] || seen[s]) continue;
    const blob: number[] = [];
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const j = stack.pop()!;
      blob.push(j);
      const x = j % w, y = (j / w) | 0;
      const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
      for (const q of nb) if (q >= 0 && !bg[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
    }
    if (blob.length > bestBlob.length) bestBlob = blob;
  }
  if (bestBlob.length < n * 0.06) return null;

  let tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, -Infinity];
  for (const j of bestBlob) {
    const x = j % w + 0.5, y = ((j / w) | 0) + 0.5;
    if (x + y < tl[2]) tl = [x, y, x + y];
    if (x - y > tr[2]) tr = [x, y, x - y];
    if (x + y > br[2]) br = [x, y, x + y];
    if (y - x > bl[2]) bl = [x, y, y - x];
  }
  const q: Quad = [[tl[0] / w, tl[1] / h], [tr[0] / w, tr[1] / h], [br[0] / w, br[1] / h], [bl[0] / w, bl[1] / h]];
  if (!convex(q)) return null;
  const area = quadArea(q);
  if (area < 0.08 || area > 0.95) return null;
  // Solid and straight-edged: the blob and its quad overlap almost exactly (IoU). A painting whose dark half blends
  // into a dark wall leaves a wavy blob, so it fails here rather than giving a wrong guess.
  const inBlob = new Uint8Array(n);
  for (const j of bestBlob) inBlob[j] = 1;
  const qpx = q.map(([x, y]) => [x * w, y * h] as [number, number]);
  let both = 0, either = 0;
  for (let j = 0; j < n; j++) {
    const inside = inQuad(qpx, (j % w) + 0.5, ((j / w) | 0) + 0.5);
    if (inside && inBlob[j]) both++;
    if (inside || inBlob[j]) either++;
  }
  if (!either || both / either < 0.955) return null;
  // each side at least a sixth of the photo, so a sliver doesn't pass
  const side = (a: [number, number], b: [number, number]) => Math.hypot((a[0] - b[0]) * w, (a[1] - b[1]) * h) / Math.max(w, h);
  if ([side(q[0], q[1]), side(q[1], q[2]), side(q[2], q[3]), side(q[3], q[0])].some((s) => s < 1 / 6)) return null;
  return q;
}

/** 3×3 linear solve (Cramer's rule); null when singular. */
function solve3(m: number[][], v: number[]): [number, number, number] | null {
  const det = (a: number[][]) => a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);
  const D = det(m);
  if (Math.abs(D) < 1e-9) return null;
  const col = (k: number) => m.map((row, r) => row.map((x, c) => (c === k ? v[r] : x)));
  return [det(col(0)) / D, det(col(1)) / D, det(col(2)) / D];
}

function inQuad(q: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
