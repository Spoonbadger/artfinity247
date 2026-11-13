// Text as SVG outlines. Same fonts and metrics on the client and the server,
// so every card is laid out identically in the preview, the SVG and the PDF.
import type { Font } from "opentype.js";

export type Fonts = { display: Font; body: Font; semi: Font };

function toArrayBuffer(b64: string): ArrayBuffer {
  if (typeof window === "undefined") {
    const b = Buffer.from(b64, "base64");
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  }
  const s = atob(b64);
  const u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u.buffer;
}

let loading: Promise<Fonts> | null = null;
export function loadFonts(): Promise<Fonts> {
  if (!loading) {
    loading = (async () => {
      const [ot, data] = await Promise.all([import("opentype.js"), import("./fonts/data")]);
      const parse: (b: ArrayBuffer) => Font = (ot as any).parse ?? (ot as any).default.parse;
      return { display: parse(toArrayBuffer(data.DISPLAY)), body: parse(toArrayBuffer(data.BODY)), semi: parse(toArrayBuffer(data.SEMI)) };
    })();
    loading.catch(() => { loading = null; });
  }
  return loading;
}

export const width = (f: Font, s: string, size: number) => f.getAdvanceWidth(s, size);
export const capHeight = (f: Font) => ((f.tables.os2?.sCapHeight as number) || 700) / f.unitsPerEm;

export type Anchor = "start" | "middle" | "end";
/** One line of outlined text. y is the baseline. */
export function textD(f: Font, s: string, x: number, y: number, size: number, anchor: Anchor = "start"): string {
  if (!s) return "";
  const w = width(f, s, size);
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return f.getPath(s, x0, y, size).toPathData(2);
}
export function text(f: Font, s: string, x: number, y: number, size: number, fill: string, anchor: Anchor = "start", opacity = 1): string {
  const d = textD(f, s, x, y, size, anchor);
  return d ? `<path fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""} d="${d}"/>` : "";
}

/** Trim with an ellipsis until it fits. */
export function fit(f: Font, s: string, size: number, maxW: number): string {
  if (width(f, s, size) <= maxW) return s;
  let t = s;
  while (t.length > 1 && width(f, t + "…", size) > maxW) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

function greedy(f: Font, words: string[], size: number, maxW: number): string[] | null {
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if (width(f, w, size) > maxW) return null;
    const t = line ? line + " " + w : w;
    if (width(f, t, size) <= maxW) line = t;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

/** Balanced wrap: fewest lines, then the most even line lengths. */
export function wrap(f: Font, s: string, size: number, maxW: number): string[] | null {
  const words = s.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const base = greedy(f, words, size, maxW);
  if (!base || base.length < 2) return base;
  let lo = 0, hi = maxW, best = base;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const t = greedy(f, words, size, mid);
    if (t && t.length === base.length) { best = t; hi = mid; } else lo = mid;
  }
  return best;
}

/**
 * Largest size (stepping down) whose balanced wrap fits the box. `fits` can add a check of its own (say, what sits
 * under the block). Nothing fits at `min`: the words fill `maxLines` and the last line ends in an ellipsis.
 */
export function fitBlock(f: Font, s: string, o: { max: number; min: number; maxW: number; maxH: number; lh: number; maxLines: number; fits?: (size: number, lines: number) => boolean }) {
  for (let size = o.max; size >= o.min; size *= 0.96) {
    const lines = wrap(f, s, size, o.maxW);
    if (lines && lines.length <= o.maxLines && blockH(f, lines.length, size, o.lh) <= o.maxH && (!o.fits || o.fits(size, lines.length))) return { lines, size };
  }
  const size = o.min;
  return { lines: clampLines(f, s, size, o.maxW, o.maxLines), size };
}

/** Greedy lines, at most `max`; the last one takes the rest of the words and ends in an ellipsis if it overflows. */
export function clampLines(f: Font, s: string, size: number, maxW: number, max: number): string[] {
  const words = s.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < max - 1) {
    let line = words[i];
    if (width(f, line, size) > maxW) break;
    let j = i + 1;
    while (j < words.length && width(f, line + " " + words[j], size) <= maxW) line += " " + words[j++];
    lines.push(line);
    i = j;
  }
  if (i < words.length) lines.push(fit(f, words.slice(i).join(" "), size, maxW));
  return lines;
}
/** Visual height of a block: cap height of the first line plus line gaps. */
export const blockH = (f: Font, n: number, size: number, lh: number) => (n ? capHeight(f) * size + (n - 1) * size * lh : 0);

/** Outlined text bent along a circle. dir 1 = over the top, -1 = under the bottom (reads left to right). */
export function arcText(f: Font, s: string, cx: number, cy: number, r: number, size: number, fill: string, dir: 1 | -1, spacing = 0, opacity = 1): string {
  const glyphs = f.stringToGlyphs(s);
  const adv = glyphs.map((g, i) => {
    let a = (g.advanceWidth || 0) * size / f.unitsPerEm + spacing;
    if (i < glyphs.length - 1) a += f.getKerningValue(g, glyphs[i + 1]) * size / f.unitsPerEm;
    return a;
  });
  const total = adv.reduce((a, b) => a + b, 0) - spacing;
  let x = 0, out = "";
  glyphs.forEach((g, i) => {
    const gw = (g.advanceWidth || 0) * size / f.unitsPerEm;
    const mid = x + gw / 2 - total / 2;
    const th = dir === 1 ? -Math.PI / 2 + mid / r : Math.PI / 2 - mid / r;
    const px = cx + r * Math.cos(th), py = cy + r * Math.sin(th);
    const rot = (th * 180) / Math.PI + (dir === 1 ? 90 : -90);
    const d = g.getPath(-gw / 2, 0, size).toPathData(2);
    if (d) out += `<path transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${rot.toFixed(2)})" d="${d}"/>`;
    x += adv[i];
  });
  return `<g fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ""}>${out}</g>`;
}
export function arcWidth(f: Font, s: string, size: number, spacing = 0) {
  return width(f, s, size) + spacing * Math.max(0, s.length - 1);
}

/** The ink box of one line drawn at (0, 0) on its baseline: x1 is the left side bearing, y1 < 0 the top, y2 the bottom. */
export function ink(f: Font, s: string, size: number) {
  if (!s.trim()) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  const b = f.getPath(s, 0, 0, size).getBoundingBox();
  return { x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2 };
}
