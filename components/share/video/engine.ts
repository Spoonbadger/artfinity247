// Auto video: vertical 1080 × 1920 share videos drawn on a canvas, frame by frame.
// Each template is a pure function of time, so the preview and the recording match.
// Text uses the same outlined fonts as the print cards (components/qr/text).
import type { Font } from "opentype.js";
import { type Fonts, textD, width, capHeight, fitBlock } from "@/components/qr/text";

export const VW = 1080;
export const VH = 1920;

export type TemplateId = "reveal" | "wall" | "detail";
export const TEMPLATES: Record<TemplateId, { name: string; sub: string; duration: number; captions: [string, string, string] }> = {
  reveal: { name: "Slow reveal", sub: "Pan, title, buy card", duration: 10, captions: ["Just finished this one", "Now it can hang in your home", "Made to order prints"] },
  wall: { name: "On the wall", sub: "At print size, over a sofa", duration: 10, captions: ["How it looks at home", "18 × 24 in print", "Free US shipping"] },
  detail: { name: "Detail tour", sub: "Three close-ups", duration: 11, captions: ["Look closer", "This part", "And this one"] },
};

export type VideoAssets = {
  img: CanvasImageSource;
  iw: number;
  ih: number;
  qr: CanvasImageSource;
  fonts: Fonts;
  palette: string[];
  accent: string;
  details: [number, number][]; // three points, 0..1 in the painting
  grain: HTMLCanvasElement | OffscreenCanvas;
};
export type VideoInfo = {
  title: string;
  artist: string;
  price: string; // "Prints from $49.99"
  priceShort: string; // "$49.99"
  edition: string | null;
  handle: string; // "theartfinity.com/@maya"
  printIn: [number, number]; // print size shown on the wall, inches (portrait order)
  captions: string[];
};
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// ---------------- math ----------------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const back = (k: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------------- painterly shapes (same paths as components/af/BrushDefs) ----------------
const P = typeof Path2D !== "undefined";
const SWATCH = P ? new Path2D("M2 9C30 1 72 13 112 6S178 1 198 10V60C170 69 122 57 80 65S22 60 2 66Z") : null; // 200 × 70
const STROKE = P ? new Path2D("M5 21C38 9 92 25 150 15S252 7 295 16L293 29C246 22 170 35 108 31S30 31 8 33Z") : null; // 300 × 40
const DAB = P ? new Path2D("M50 4C74 2 97 22 95 50S76 98 48 96 3 76 5 48 26 6 50 4Z") : null; // 100 × 100
const TAG = P ? new Path2D("M4 60 V189 Q4 196 11 196 H89 Q96 196 96 189 V60 L50 20 Z M50 38 a8 8 0 1 0 0.01 0 Z") : null; // 100 × 200, hole on top

function shape(ctx: Ctx, p: Path2D | null, vw: number, vh: number, x: number, y: number, w: number, h: number, fill: string, alpha = 1) {
  if (!p) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.scale(w / vw, h / vh);
  ctx.fillStyle = fill;
  ctx.fill(p, "evenodd");
  ctx.restore();
}
const swatch = (ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, a = 1) => shape(ctx, SWATCH, 200, 70, x, y, w, h, fill, a);
const stroke = (ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, a = 1) => shape(ctx, STROKE, 300, 40, x, y, w, h, fill, a);
function dab(ctx: Ctx, cx: number, cy: number, r: number, fill: string, rot = -14, a = 1) {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((rot * Math.PI) / 180);
  shape(ctx, DAB, 100, 100, -r, -r, 2 * r, 2 * r, fill, a);
  ctx.restore();
}

// ---------------- text ----------------
const pathCache = new WeakMap<Font, Map<string, Path2D>>();
function glyphs(f: Font, s: string, size: number, anchor: "start" | "middle" | "end") {
  let m = pathCache.get(f);
  if (!m) { m = new Map(); pathCache.set(f, m); }
  const k = `${anchor}|${size}|${s}`;
  let p = m.get(k);
  if (!p) { p = new Path2D(textD(f, s, 0, 0, size, anchor) || "M0 0"); if (m.size > 400) m.clear(); m.set(k, p); }
  return p;
}
function txt(ctx: Ctx, f: Font, s: string, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end" = "start", alpha = 1) {
  if (!s || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.fill(glyphs(f, s, size, anchor));
  ctx.restore();
}

// ---------------- pieces ----------------
const grainPatterns = new WeakMap<object, CanvasPattern | null>();
function paper(ctx: Ctx, A: VideoAssets, color = "#f2f3ec", grainAlpha = 0.6) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VW, VH);
  let pat = grainPatterns.get(ctx);
  if (pat === undefined) { pat = ctx.createPattern(A.grain as CanvasImageSource, "repeat"); grainPatterns.set(ctx, pat); }
  if (pat) { ctx.save(); ctx.globalAlpha = grainAlpha; ctx.fillStyle = pat; ctx.fillRect(0, 0, VW, VH); ctx.restore(); }
}

function fit(iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const k = Math.min(w / iw, h / ih);
  return { x: x + (w - iw * k) / 2, y: y + (h - ih * k) / 2, w: iw * k, h: ih * k };
}

/** Painting in a white mat (and optional dark frame) with a soft shadow. */
function framed(ctx: Ctx, A: VideoAssets, r: { x: number; y: number; w: number; h: number }, o: { mat?: number; frame?: number; rot?: number; alpha?: number; shadow?: number } = {}) {
  const mat = o.mat ?? 16, fr = o.frame ?? 0, a = o.alpha ?? 1;
  if (a <= 0) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(cx, cy);
  if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);
  const ow = r.w + 2 * (mat + fr), oh = r.h + 2 * (mat + fr);
  ctx.save();
  ctx.shadowColor = "rgba(21,22,27,.32)";
  ctx.shadowBlur = o.shadow ?? 36;
  ctx.shadowOffsetY = (o.shadow ?? 36) * 0.45;
  ctx.fillStyle = fr ? "#15161b" : "#ffffff";
  ctx.fillRect(-ow / 2, -oh / 2, ow, oh);
  ctx.restore();
  if (fr) { ctx.fillStyle = "#ffffff"; ctx.fillRect(-ow / 2 + fr, -oh / 2 + fr, ow - 2 * fr, oh - 2 * fr); }
  ctx.drawImage(A.img, -r.w / 2, -r.h / 2, r.w, r.h);
  ctx.restore();
}

function brand(ctx: Ctx, A: VideoAssets, x: number, y: number, size: number, ink: string, mark = "#2b37f0", alpha = 1) {
  const f = A.fonts.display, b = size * 0.95, k = b / 24, top = y - capHeight(f) * size - b * 0.06;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, top); ctx.scale(k, k);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.roundRect(1, 1, 22, 22, 3.5); ctx.stroke();
  ctx.fillStyle = mark; ctx.beginPath(); ctx.roundRect(8.25, 8.25, 7.5, 7.5, 1.6); ctx.fill();
  ctx.restore();
  txt(ctx, f, "artfinity", x + b + size * 0.32, y, size, ink, "start", alpha);
}

/** A caption on a white brush stroke, painted in from the left. k = seconds since it started, dur = how long it stays. */
function caption(ctx: Ctx, A: VideoAssets, s: string, k: number, dur: number, y = 250) {
  if (!s.trim() || k < 0 || k > dur) return;
  const f = A.fonts.display;
  const T = fitBlock(f, s.trim(), { max: 70, min: 46, maxW: 820, maxH: 150, lh: 1.08, maxLines: 2 });
  const out = 1 - seg(k, dur - 0.3, dur);
  const grow = easeOut(seg(k, 0, 0.35));
  ctx.save();
  ctx.globalAlpha *= out;
  ctx.translate(90, y);
  ctx.rotate((-2 * Math.PI) / 180);
  T.lines.forEach((line, i) => {
    const w = width(f, line, T.size) + 70, h = T.size * 1.45, ly = i * T.size * 1.12;
    ctx.save();
    ctx.beginPath(); ctx.rect(-40, ly - 20, (w + 60) * grow, h + 40); ctx.clip();
    stroke(ctx, -34, ly - h * 0.12, w, h, "#ffffff", 0.96);
    ctx.restore();
    txt(ctx, f, line, 0, ly + h / 2 + capHeight(f) * T.size / 2 - h * 0.06, T.size, "#15161b", "start", seg(k, 0.12, 0.4));
  });
  ctx.restore();
}

// ---------------- the brush-stroke wipe ----------------
// Six wide brush strokes, alternating direction, each with a rounded, bristly head.
const ROWS = 6;
type Row = { dir: 1 | -1; edge: number; y0: number; y1: number; i: number };
function wipeRows(p: number): Row[] {
  const rowH = VH / ROWS, over = rowH * 0.3, lag = 0.08, rows: Row[] = [];
  for (let i = 0; i < ROWS; i++) {
    const k = ease(clamp((p - i * lag) / (1 - (ROWS - 1) * lag)));
    if (k <= 0) continue;
    rows.push({ i, dir: i % 2 ? -1 : 1, edge: -200 + (VW + 400) * k, y0: i * rowH - over, y1: (i + 1) * rowH + over });
  }
  return rows;
}
function wipePath(p: number): Path2D {
  const path = new Path2D();
  for (const { i, dir, edge, y0, y1 } of wipeRows(p)) {
    const X = (x: number) => (dir === 1 ? x : VW - x);
    const wave = (x: number, ph: number) => Math.sin(x / 130 + i * 1.7 + ph) * 16 + hash(i, Math.round(x / 40)) * 10;
    const head = edge - 80;
    path.moveTo(X(-60), y0 + wave(-60, 0));
    for (let x = -20; x < head; x += 40) path.lineTo(X(x), y0 + wave(x, 0));
    const mid = (y0 + y1) / 2, half = (y1 - y0) / 2;
    for (let yy = y0; yy <= y1; yy += 9) {
      const r = (yy - mid) / half;
      path.lineTo(X(head + Math.sqrt(Math.max(0, 1 - r * r)) * 80 + (hash(i * 13, yy) - 0.5) * 26), yy);
    }
    for (let x = head; x > -60; x -= 40) path.lineTo(X(x), y1 - wave(x, 2));
    path.closePath();
  }
  return path;
}
/** Bristle streaks inside the painted band, so it reads as paint and not a flat shape. */
function streaks(ctx: Ctx, p: number) {
  ctx.save();
  ctx.lineCap = "round";
  for (const { i, dir, edge, y0, y1 } of wipeRows(p)) {
    for (let s = 0; s < 7; s++) {
      const y = y0 + (y1 - y0) * (0.12 + s * 0.125) + (hash(i, s) - 0.5) * 20;
      const len = edge - 40 - hash(s, i) * 160;
      if (len <= 0) continue;
      ctx.strokeStyle = s % 2 ? "rgba(255,255,255,.22)" : "rgba(21,22,27,.10)";
      ctx.lineWidth = 3 + hash(i + s, 3) * 6;
      ctx.beginPath();
      const x0 = dir === 1 ? -20 : VW + 20, x1 = dir === 1 ? len : VW - len;
      ctx.moveTo(x0, y); ctx.quadraticCurveTo((x0 + x1) / 2, y + (hash(s, i + 5) - 0.5) * 24, x1, y + (hash(i, s + 9) - 0.5) * 12);
      ctx.stroke();
    }
  }
  ctx.restore();
}
function wipe(ctx: Ctx, p: number, a: () => void, b: () => void, color: string) {
  if (p <= 0) return a();
  if (p >= 1) return b();
  a();
  const band = wipePath(Math.min(1, p + 0.08));
  ctx.save(); ctx.fillStyle = color; ctx.fill(band); ctx.clip(band); streaks(ctx, Math.min(1, p + 0.08)); ctx.restore();
  ctx.save(); ctx.clip(wipePath(p)); b(); ctx.restore();
}

// ---------------- end card (shared) ----------------
function endCard(ctx: Ctx, A: VideoAssets, I: VideoInfo, k: number) {
  const F = A.fonts;
  paper(ctx, A);
  const pic = fit(A.iw, A.ih, 200, 230, 680, 600);
  // accent swatch behind the painting
  ctx.save();
  ctx.translate(540, pic.y + pic.h / 2); ctx.rotate((4 * Math.PI) / 180);
  ctx.beginPath(); ctx.rect(-600, -600, 1200 * easeOut(seg(k, 0, 0.5)), 1200); ctx.clip();
  swatch(ctx, -pic.w / 2 - 70, -pic.h / 2 + 30, pic.w + 160, pic.h + 30, A.accent, 0.92);
  ctx.restore();
  const rise = (a: number) => (1 - easeOut(seg(k, a, a + 0.6))) * 40;
  framed(ctx, A, { ...pic, y: pic.y + rise(0.1) }, { mat: 16, rot: -1.5, alpha: seg(k, 0.1, 0.5) });
  brand(ctx, A, 90, 150, 40, "#15161b", "#2b37f0", seg(k, 0, 0.4));

  const T = fitBlock(F.display, I.title, { max: 92, min: 54, maxW: 900, maxH: 170, lh: 0.95, maxLines: 2 });
  let y = pic.y + pic.h + 90 + rise(0.3);
  const a1 = seg(k, 0.3, 0.7);
  T.lines.forEach((ln, i) => txt(ctx, F.display, ln, 90, y + capHeight(F.display) * T.size + i * T.size * 0.95, T.size, "#15161b", "start", a1));
  y += capHeight(F.display) * T.size + (T.lines.length - 1) * T.size * 0.95 + 56;
  txt(ctx, F.body, `by ${I.artist}`, 90, y, 36, "#5a5d6b", "start", a1);
  y += 30;
  const a2 = seg(k, 0.45, 0.85);
  const pw = width(F.semi, I.price, 36) + 56;
  swatch(ctx, 80, y, pw, 74, "#ffd43b", a2);
  txt(ctx, F.semi, I.price, 108, y + 37 + capHeight(F.semi) * 18, 36, "#15161b", "start", a2);
  y += 82;
  if (I.edition) {
    dab(ctx, 104, y + 22, 12, "#ff5a36", -14, a2);
    txt(ctx, F.semi, I.edition, 128, y + 22 + capHeight(F.semi) * 15, 30, "#15161b", "start", a2);
    y += 50;
  }
  // QR card
  const cy = Math.max(1230, y + 30), pop = back(seg(k, 0.6, 1.1)), a3 = seg(k, 0.6, 0.9);
  ctx.save();
  ctx.globalAlpha *= a3;
  ctx.translate(540, cy + 190); ctx.scale(lerp(0.9, 1, pop), lerp(0.9, 1, pop)); ctx.translate(-540, -(cy + 190));
  ctx.fillStyle = "#ffffff"; ctx.strokeStyle = "#e1e2da"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(90, cy, 900, 380, 28); ctx.fill(); ctx.stroke();
  ctx.drawImage(A.qr, 112, cy + 22, 336, 336);
  txt(ctx, F.display, "Scan or tap", 480, cy + 130, 64, "#15161b");
  txt(ctx, F.display, "to buy a print", 480, cy + 196, 64, "#15161b");
  const hw = Math.min(480, width(F.semi, I.handle, 30) + 30);
  stroke(ctx, 470, cy + 236, hw, 46, "#ffd43b", 0.9);
  txt(ctx, F.semi, I.handle, 482, cy + 268, I.handle.length > 30 ? 26 : 30, "#15161b");
  ctx.restore();
  // palette dabs below
  A.palette.slice(0, 5).forEach((c, i) => dab(ctx, 120 + i * 62, cy + 450, 20, c, -14 + i * 23, seg(k, 0.9 + i * 0.06, 1.2 + i * 0.06)));
}

// ---------------- template 1: slow reveal ----------------
function kenBurns(ctx: Ctx, A: VideoAssets, t: number) {
  const u = ease(seg(t, 0, 7.4));
  const cover = Math.max(VW / A.iw, VH / A.ih);
  const s = cover * lerp(1.34, 1.04, u);
  const dw = A.iw * s, dh = A.ih * s;
  const fx = lerp(0.28, 0.7, u), fy = lerp(0.32, 0.62, u);
  const x = clamp(VW / 2 - fx * dw, VW - dw, 0), y = clamp(VH / 2 - fy * dh, VH - dh, 0);
  ctx.drawImage(A.img, x, y, dw, dh);
}
function intro(ctx: Ctx, A: VideoAssets) {
  paper(ctx, A);
  brand(ctx, A, 90, 150, 40, "#15161b");
}
function reveal(ctx: Ctx, t: number, A: VideoAssets, I: VideoInfo) {
  const scene = () => {
    kenBurns(ctx, A, t);
    const g = ctx.createLinearGradient(0, 880, 0, VH);
    g.addColorStop(0, "rgba(21,22,27,0)"); g.addColorStop(0.45, "rgba(21,22,27,.55)"); g.addColorStop(1, "rgba(21,22,27,.82)");
    ctx.save(); ctx.globalAlpha = seg(t, 1.2, 2.2); ctx.fillStyle = g; ctx.fillRect(0, 880, VW, VH - 880); ctx.restore();
    const F = A.fonts, a = seg(t, 1.6, 2.4), dy = (1 - easeOut(seg(t, 1.6, 2.5))) * 30;
    const T = fitBlock(F.display, I.title, { max: 120, min: 64, maxW: 900, maxH: 230, lh: 0.95, maxLines: 2 });
    const top = 1210 + dy;
    T.lines.forEach((ln, i) => txt(ctx, F.display, ln, 90, top + capHeight(F.display) * T.size + i * T.size * 0.95, T.size, "#ffffff", "start", a));
    const by = top + capHeight(F.display) * T.size + (T.lines.length - 1) * T.size * 0.95 + 62;
    txt(ctx, F.body, `by ${I.artist}`, 90, by, 40, "#ffffff", "start", a * 0.85);
    txt(ctx, F.semi, I.price, 90, by + 60, 36, "#ffd43b", "start", seg(t, 2.4, 3));
    brand(ctx, A, 90, 150, 40, "#ffffff", "#ffd43b", seg(t, 1.0, 1.6));
    caption(ctx, A, I.captions[0] || "", t - 0.9, 2.1);
    caption(ctx, A, I.captions[1] || "", t - 3.0, 2.0);
    caption(ctx, A, I.captions[2] || "", t - 5.0, 2.0);
  };
  if (t < 7) return wipe(ctx, seg(t, 0, 0.9), () => intro(ctx, A), scene, A.accent);
  wipe(ctx, seg(t, 7, 7.8), scene, () => endCard(ctx, A, I, t - 7.5), A.accent);
}

// ---------------- template 2: on the wall ----------------
const S = 10.8; // px per inch at zoom 1
const FLOOR = 1480, SOFA_W = 84 * S, SOFA_H = 33 * S, SOFA_BOTTOM = 1525;
function wallGeo(I: VideoInfo, A: VideoAssets) {
  const [a, b] = I.printIn;
  const land = A.iw > A.ih;
  const fr = 1.25 * S;
  const w = (land ? b : a) * S, h = (land ? a : b) * S;
  const bottom = SOFA_BOTTOM - SOFA_H - 9 * S;
  return { x: 540 - w / 2, y: bottom - h, w, h, fr };
}
function room(ctx: Ctx, A: VideoAssets) {
  ctx.fillStyle = "#e9e6df"; ctx.fillRect(-400, -400, VW + 800, FLOOR + 400);
  const g = ctx.createRadialGradient(540, 620, 40, 540, 620, 900);
  g.addColorStop(0, "rgba(255,255,255,.75)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(-400, -400, VW + 800, FLOOR + 400);
  let pat = grainPatterns.get(ctx);
  if (pat === undefined) { pat = ctx.createPattern(A.grain as CanvasImageSource, "repeat"); grainPatterns.set(ctx, pat); }
  if (pat) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = pat; ctx.fillRect(-400, -400, VW + 800, FLOOR + 400); ctx.restore(); }
  ctx.fillStyle = "#ffffff"; ctx.fillRect(-400, FLOOR - 26, VW + 800, 26);
  ctx.fillStyle = "#b6987a"; ctx.fillRect(-400, FLOOR, VW + 800, VH - FLOOR + 400);
  ctx.strokeStyle = "rgba(90,60,40,.18)"; ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const y = FLOOR + 40 + i * i * 22; ctx.beginPath(); ctx.moveTo(-400, y); ctx.lineTo(VW + 400, y); ctx.stroke(); }
  // sofa (same drawing as the buy page wall preview), units of inches
  ctx.save();
  ctx.translate(540 - SOFA_W / 2, SOFA_BOTTOM - SOFA_H); ctx.scale(S, S);
  ctx.fillStyle = "rgba(21,22,27,.12)"; ctx.beginPath(); ctx.ellipse(42, 33.2, 44, 2.2, 0, 0, Math.PI * 2); ctx.fill();
  const r = (x: number, y: number, w: number, h: number, rr: number, c: string) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(x, y, w, h, rr); ctx.fill(); };
  r(4, 0, 76, 20, 4, "#8f8b83"); r(0, 12, 9, 19, 3.5, "#7d7972"); r(75, 12, 9, 19, 3.5, "#7d7972"); r(8, 17, 68, 12, 2.5, "#9b978e");
  r(10, 29, 3, 4, 0, "#5c5952"); r(71, 29, 3, 4, 0, "#5c5952");
  // cushions in the painting's colors
  r(14, 6, 14, 12, 3, A.palette[1] || "#c9b8a0"); r(56, 6, 14, 12, 3, A.palette[2] || "#a8b5a0");
  ctx.restore();
  // floor lamp
  ctx.save(); ctx.translate(VW - 40 - 14 * S, SOFA_BOTTOM - 62 * S); ctx.scale(S, S);
  ctx.fillStyle = "#dccfb4"; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(12, 0); ctx.lineTo(14, 11); ctx.lineTo(0, 11); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#6f6c66"; ctx.fillRect(6.4, 11, 1.2, 49); ctx.fillRect(3, 60, 8, 2);
  ctx.restore();
  // plant
  ctx.save(); ctx.translate(26, SOFA_BOTTOM - 30 * S); ctx.scale(S, S);
  ctx.fillStyle = "#6f8a6a"; ctx.fill(new Path2D("M8 20 C 2 14, 1 6, 3 1 C 6 6, 8 12, 8 20 Z"));
  ctx.fillStyle = "#5d7a5a"; ctx.fill(new Path2D("M8 20 C 13 13, 15 7, 13 2 C 10 7, 8 13, 8 20 Z"));
  ctx.fillStyle = "#7f9a78"; ctx.fill(new Path2D("M8 21 C 4 18, 0 16, 0 11 C 4 13, 7 16, 8 21 Z"));
  ctx.fillStyle = "#b9805a"; ctx.fill(new Path2D("M4 20 H12 L11 30 H5 Z"));
  ctx.restore();
}
function priceTag(ctx: Ctx, A: VideoAssets, I: VideoInfo, nx: number, ny: number, drop: number, theta: number) {
  // nail, string, tag (100 × 200 units, hole on top), swinging about the nail
  const w = 92, h = 184, len = 36;
  ctx.fillStyle = "#5c5952"; ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(nx, ny - drop); ctx.rotate(theta);
  ctx.strokeStyle = "#15161b"; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-6, len * 0.6, 0, len + 0.38 * h * 0.19); ctx.stroke();
  ctx.translate(-w / 2, len - 0.2 * h * 0.19);
  ctx.save(); ctx.shadowColor = "rgba(21,22,27,.25)"; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5;
  shape(ctx, TAG, 100, 200, 0, 0, w, h, "#ffd43b");
  ctx.restore();
  const F = A.fonts;
  txt(ctx, F.semi, "Prints", w / 2, h * 0.45, 15, "#15161b", "middle");
  txt(ctx, F.semi, "from", w / 2, h * 0.55, 15, "#15161b", "middle");
  const ps = Math.min(32, (32 * (w - 12)) / width(F.display, I.priceShort, 32));
  txt(ctx, F.display, I.priceShort, w / 2, h * 0.74, ps, "#15161b", "middle");
  ctx.restore();
}
function onWall(ctx: Ctx, t: number, A: VideoAssets, I: VideoInfo) {
  const G = wallGeo(I, A);
  const nx = G.x + G.w + G.fr + 70, ny = G.y + 30;
  const scene = () => {
    const z = lerp(1, 1.9, ease(seg(t, 3.0, 6.2)));
    const cx = lerp(540, (G.x + nx + 60) / 2, ease(seg(t, 3.0, 6.2)));
    const cy = lerp(960, G.y + G.h / 2 + 40, ease(seg(t, 3.0, 6.2)));
    ctx.save();
    ctx.translate(VW / 2, VH / 2); ctx.scale(z, z); ctx.translate(-cx, -cy);
    room(ctx, A);
    const a = seg(t, 1.0, 2.0), drop = (1 - easeOut(seg(t, 1.0, 2.1))) * 24;
    framed(ctx, A, { x: G.x, y: G.y - drop, w: G.w, h: G.h }, { mat: 0.5, frame: G.fr, alpha: a, shadow: 14 });
    if (t > 2.3) {
      const k = t - 2.3;
      const drop2 = (1 - back(seg(k, 0, 0.55))) * 260;
      const th = 0.55 * Math.exp(-1.5 * Math.max(0, k - 0.3)) * Math.cos(6.2 * Math.max(0, k - 0.3)) * seg(k, 0.15, 0.35);
      priceTag(ctx, A, I, nx, ny, drop2, th);
    }
    // size label under the print
    txt(ctx, A.fonts.semi, `${I.printIn[0]} × ${I.printIn[1]} in print`, G.x + G.w / 2, G.y + G.h + G.fr + 26, 15, "#5a5d6b", "middle", seg(t, 3.4, 4.2));
    ctx.restore();
    brand(ctx, A, 90, 150, 40, "#15161b", "#2b37f0", seg(t, 0.8, 1.4));
    caption(ctx, A, I.captions[0] || "", t - 1.0, 2.2, 260);
    caption(ctx, A, I.captions[1] || "", t - 3.2, 1.9, 260);
    caption(ctx, A, I.captions[2] || "", t - 5.1, 1.9, 260);
  };
  if (t < 7) return wipe(ctx, seg(t, 0, 0.9), () => intro(ctx, A), scene, A.accent);
  wipe(ctx, seg(t, 7, 7.8), scene, () => endCard(ctx, A, I, t - 7.5), A.accent);
}

// ---------------- template 3: detail tour ----------------
function detailTour(ctx: Ctx, t: number, A: VideoAssets, I: VideoInfo) {
  const pic = fit(A.iw, A.ih, 110, 300, 860, 1180);
  const at = (p: [number, number]) => [pic.x + p[0] * pic.w, pic.y + p[1] * pic.h] as const;
  const home = [pic.x + pic.w / 2, pic.y + pic.h / 2] as const;
  const Z = 2.5;
  const d = A.details.length >= 3 ? A.details : ([[0.3, 0.3], [0.7, 0.5], [0.4, 0.75]] as [number, number][]);
  const keys: [number, number, number, number][] = [
    [1.4, home[0], home[1], 1], [2.4, ...at(d[0]), Z], [3.2, ...at(d[0]), Z], [4.0, ...at(d[1]), Z],
    [4.8, ...at(d[1]), Z], [5.6, ...at(d[2]), Z], [6.4, ...at(d[2]), Z], [7.4, home[0], home[1], 1],
  ];
  let cam = keys[0];
  if (t >= keys[keys.length - 1][0]) cam = keys[keys.length - 1];
  else for (let i = 0; i < keys.length - 1; i++) {
    const [t0, x0, y0, z0] = keys[i], [t1, x1, y1, z1] = keys[i + 1];
    if (t >= t0 && t < t1) { const k = ease((t - t0) / (t1 - t0)); cam = [t, lerp(x0, x1, k), lerp(y0, y1, k), lerp(z0, z1, k)]; break; }
  }
  const scene = () => {
    paper(ctx, A, "#ece9e1");
    ctx.save();
    ctx.translate(VW / 2, VH / 2); ctx.scale(cam[3], cam[3]); ctx.translate(-cam[1], -cam[2]);
    framed(ctx, A, pic, { mat: 18, shadow: 40 });
    ctx.restore();
    brand(ctx, A, 90, 150, 40, "#15161b", "#2b37f0", seg(t, 0.8, 1.4));
    // which detail: three paint dabs, top right
    const which = t < 2.0 ? -1 : t < 3.6 ? 0 : t < 5.2 ? 1 : t < 7.0 ? 2 : -1;
    const da = seg(t, 1.8, 2.2) * (1 - seg(t, 6.8, 7.2));
    for (let i = 0; i < 3; i++) dab(ctx, 860 + i * 52, 136, i === which ? 18 : 12, i === which ? A.accent : "#15161b", -14 + i * 30, da * (i === which ? 1 : 0.35));
    caption(ctx, A, I.captions[0] || "", t - 2.2, 1.5, 260);
    caption(ctx, A, I.captions[1] || "", t - 3.8, 1.5, 260);
    caption(ctx, A, I.captions[2] || "", t - 5.4, 1.6, 260);
    // title over the pulled-back view
    const ta = seg(t, 7.2, 7.7);
    if (ta > 0) {
      txt(ctx, A.fonts.display, I.title, 540, 1640, Math.min(84, (84 * 900) / width(A.fonts.display, I.title, 84)), "#15161b", "middle", ta);
      txt(ctx, A.fonts.body, `by ${I.artist}`, 540, 1700, 36, "#5a5d6b", "middle", ta);
    }
  };
  if (t < 8) return wipe(ctx, seg(t, 0, 0.9), () => intro(ctx, A), scene, A.accent);
  wipe(ctx, seg(t, 8, 8.8), scene, () => endCard(ctx, A, I, t - 8.5), A.accent);
}

export function drawFrame(ctx: Ctx, id: TemplateId, t: number, A: VideoAssets, I: VideoInfo) {
  ctx.save();
  if (id === "wall") onWall(ctx, t, A, I);
  else if (id === "detail") detailTour(ctx, t, A, I);
  else reveal(ctx, t, A, I);
  ctx.restore();
}

// ---------------- analysis helpers ----------------
/** Three busy, well-separated spots (0..1) from small grayscale-able RGBA data. */
export function findDetails(data: ArrayLike<number>, w: number, h: number): [number, number][] {
  const g = (x: number, y: number) => { const i = (y * w + x) * 4; return 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2]; };
  const cols = 5, rows = 6, cells: { x: number; y: number; v: number }[] = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let v = 0;
    const x0 = Math.floor((cx * w) / cols), x1 = Math.floor(((cx + 1) * w) / cols) - 1;
    const y0 = Math.floor((cy * h) / rows), y1 = Math.floor(((cy + 1) * h) / rows) - 1;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) v += Math.abs(g(x + 1, y) - g(x, y)) + Math.abs(g(x, y + 1) - g(x, y));
    cells.push({ x: clamp((cx + 0.5) / cols, 0.22, 0.78), y: clamp((cy + 0.5) / rows, 0.2, 0.8), v });
  }
  cells.sort((a, b) => b.v - a.v);
  const out: [number, number][] = [];
  for (const c of cells) {
    if (out.every(([x, y]) => Math.hypot(x - c.x, y - c.y) > 0.3)) out.push([c.x, c.y]);
    if (out.length === 3) break;
  }
  while (out.length < 3) out.push([[0.3, 0.3], [0.7, 0.5], [0.4, 0.75]][out.length] as [number, number]);
  // Tour order: top to bottom reads naturally.
  return out.sort((a, b) => a[1] - b[1]);
}

/** A 256 px paper grain tile. */
export function makeGrain(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!;
  const im = x.createImageData(256, 256);
  let seed = 11;
  for (let i = 0; i < 256 * 256; i++) {
    seed = (seed * 16807) % 2147483647;
    const v = seed / 2147483647, light = v > 0.5;
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = light ? 255 : 40;
    im.data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 30);
  }
  x.putImageData(im, 0, 0);
  return c;
}

// ---------------- making the file ----------------
// Best: WebCodecs, frame by frame at exactly 30 fps (faster than real time on most machines, and
// never drops frames). Fallback: MediaRecorder on a canvas stream, in real time.
export const FPS = 30;
export type VideoType = { ext: "mp4" | "webm"; label: "MP4" | "WebM"; how: "codecs" | "recorder"; codec: string };

const CODECS: VideoType[] = [
  { ext: "mp4", label: "MP4", how: "codecs", codec: "avc1.640028" },
  { ext: "mp4", label: "MP4", how: "codecs", codec: "avc1.4d0028" },
  { ext: "mp4", label: "MP4", how: "codecs", codec: "avc1.42e028" },
  { ext: "webm", label: "WebM", how: "codecs", codec: "vp09.00.40.08" },
  { ext: "webm", label: "WebM", how: "codecs", codec: "vp8" },
];
const RECORDER: VideoType[] = [
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4;codecs=avc1.640028" },
  { ext: "mp4", label: "MP4", how: "recorder", codec: "video/mp4;codecs=avc1" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm;codecs=vp9" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm;codecs=vp8" },
  { ext: "webm", label: "WebM", how: "recorder", codec: "video/webm" },
];
const encoderConfig = (t: VideoType): VideoEncoderConfig => ({
  codec: t.codec, width: VW, height: VH, bitrate: 10_000_000, framerate: FPS,
  ...(t.ext === "mp4" ? { avc: { format: "avc" as const } } : {}),
});

/** File types this browser can make, best first: at most one MP4 and one WebM. */
export async function videoTypes(): Promise<VideoType[]> {
  if (typeof window === "undefined") return [];
  const out: VideoType[] = [];
  if (typeof VideoEncoder !== "undefined" && typeof VideoFrame !== "undefined") {
    for (const t of CODECS) {
      if (out.some((o) => o.ext === t.ext)) continue;
      try { if ((await VideoEncoder.isConfigSupported(encoderConfig(t))).supported) out.push(t); } catch { /* not this one */ }
    }
  }
  if (typeof MediaRecorder !== "undefined" && "captureStream" in HTMLCanvasElement.prototype) {
    for (const t of RECORDER) {
      if (out.some((o) => o.ext === t.ext)) continue;
      try { if (MediaRecorder.isTypeSupported(t.codec)) out.push(t); } catch { /* not this one */ }
    }
  }
  return out.sort((a, b) => (a.ext === b.ext ? 0 : a.ext === "mp4" ? -1 : 1));
}

const abortError = () => new DOMException("Stopped", "AbortError");
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function makeVideo(id: TemplateId, A: VideoAssets, I: VideoInfo, type: VideoType, onProgress: (k: number) => void, signal?: AbortSignal): Promise<Blob> {
  return type.how === "codecs" ? encode(id, A, I, type, onProgress, signal) : record(id, A, I, type, onProgress, signal);
}

async function encode(id: TemplateId, A: VideoAssets, I: VideoInfo, type: VideoType, onProgress: (k: number) => void, signal?: AbortSignal): Promise<Blob> {
  const { muxMP4, muxWebM } = await import("./mux");
  const canvas = document.createElement("canvas");
  canvas.width = VW; canvas.height = VH;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("No canvas");
  const chunks: { data: Uint8Array; key: boolean }[] = [];
  let avcC: Uint8Array | null = null;
  let failure: Error | null = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => {
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks.push({ data, key: chunk.type === "key" });
      const d = meta?.decoderConfig?.description;
      if (d && !avcC) avcC = d instanceof ArrayBuffer ? new Uint8Array(d.slice(0)) : new Uint8Array((d as ArrayBufferView).buffer.slice(0));
    },
    error: (e) => { failure = e instanceof Error ? e : new Error(String(e)); },
  });
  enc.configure(encoderConfig(type));
  const frames = Math.round(TEMPLATES[id].duration * FPS);
  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) throw abortError();
      if (failure) throw failure;
      drawFrame(ctx, id, i / FPS, A, I);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / FPS), duration: Math.round(1e6 / FPS) });
      enc.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      onProgress((i + 1) / frames);
      while (enc.encodeQueueSize > 3) await pause(4);
      if (i % 3 === 0) await pause(0); // let the page breathe
    }
    await enc.flush();
  } finally {
    if (enc.state !== "closed") enc.close();
  }
  if (failure) throw failure;
  if (type.ext === "mp4") {
    if (!avcC) throw new Error("Encoder gave no H.264 config");
    return muxMP4(chunks, avcC, VW, VH, FPS);
  }
  return muxWebM(chunks, type.codec.startsWith("vp09") ? "V_VP9" : "V_VP8", VW, VH, FPS);
}

/** Fallback: plays the template in real time into a MediaRecorder. */
function record(id: TemplateId, A: VideoAssets, I: VideoInfo, type: VideoType, onProgress: (k: number) => void, signal?: AbortSignal): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = VW; canvas.height = VH;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return reject(new Error("No canvas"));
    const duration = TEMPLATES[id].duration;
    drawFrame(ctx, id, 0, A, I);
    const stream = canvas.captureStream(FPS);
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream, { mimeType: type.codec, videoBitsPerSecond: 10_000_000 }); }
    catch (e) { return reject(e); }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => reject((e as unknown as { error?: Error }).error || new Error("Recording failed"));
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      if (signal?.aborted) return reject(abortError());
      resolve(new Blob(chunks, { type: type.codec.split(";")[0] }));
    };
    let start = 0, raf = 0, done = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      if (timer) clearInterval(timer);
      if (rec.state !== "inactive") rec.stop();
    };
    const tick = () => {
      if (done) return;
      if (signal?.aborted) return finish();
      const t = (performance.now() - start) / 1000;
      drawFrame(ctx, id, Math.min(t, duration), A, I);
      onProgress(Math.min(1, t / duration));
      if (t >= duration + 0.15) finish();
    };
    const loop = () => { tick(); if (!done) raf = requestAnimationFrame(loop); };
    rec.start(500);
    start = performance.now();
    // rAF for smooth frames; the interval keeps time moving if the tab is in the background.
    timer = setInterval(() => { if (document.hidden) tick(); }, 1000 / FPS);
    raf = requestAnimationFrame(loop);
  });
}
