// Share kit videos: every preset in lib/social/presets.ts drawn on a canvas, frame by frame, at 1080 × 1920 or
// 1080 × 1080. Each preset is a pure function of time, so the live preview and the recorded file match.
// Room scenes are the composited JPGs from /api/scenes/render (lib/scenes); before/after uses the drawn rooms (lib/rooms).
// Text is drawn as outlines with the print-card fonts (components/qr/text), so it looks the same in every browser.
import type { Font } from "opentype.js";
import { type Fonts, textD, width, capHeight, fitBlock } from "@/components/qr/text";
import { FORMATS, SEASONS, presetOf, OUTRO_SECONDS, type BrandColors, type PresetId, type Season, type VideoFormat } from "@/lib/social/presets";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Img = CanvasImageSource;

export type Piece = {
  slug: string;
  title: string;
  /** "Prints from $49.99" */
  price: string;
  img: Img;
  iw: number;
  ih: number;
  accent: string;
  palette: string[];
  /** The busiest spot in the painting, 0..1 (the close-up zooms here). */
  detail: [number, number];
  /** Blurred copy for the countdown reveal. */
  soft?: Img;
};
/** A room picture; `box` is where the print hangs in it (x0, y0, x1, y1 as fractions), when known. */
export type Shot = { img: Img; iw: number; ih: number; label: string; size?: string; box?: [number, number, number, number] };

export type VideoAssets = {
  fonts: Fonts;
  grain: Img;
  qr: Img;
  /** [0] is the main piece; walks and carousels use them all. */
  pieces: Piece[];
  /** Room tour: 3–4 rooms with the print hung. */
  scenes: Shot[];
  /** Size compare: one room at each print size. */
  sizes: Shot[];
  sizeNote?: string;
  /** Before/after: the same drawn room without and with the print. */
  before?: Shot | null;
  after?: Shot | null;
  logo?: { img: Img; w: number; h: number } | null;
};

export type VideoText = {
  artist: string;
  /** "theartfinity.com/@maya" */
  handle: string;
  /** The buy line under the price. */
  cta: string;
  /** Collection title, "Artist of the week", the drop's name… */
  headline?: string;
  /** New drop date, YYYY-MM-DD. */
  dropDate?: string;
  season?: Season;
};

export type VideoSpec = { preset: PresetId; format: VideoFormat; brand: BrandColors; text: VideoText };

export const FPS = 30;
export const sizeOf = (f: VideoFormat) => FORMATS[f];
export const durationFor = (spec: VideoSpec, A?: Pick<VideoAssets, "logo"> | null) => presetOf(spec.preset).duration + (A?.logo ? OUTRO_SECONDS : 0);

// ---------------- math ----------------
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const sine = (k: number) => 0.5 - Math.cos(Math.PI * k) / 2;
const back = (k: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const hash = (a: number, b: number) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

/** Frame geometry: W × H, and `v` = is it the tall format. */
type L = { W: number; H: number; v: boolean; cx: number };
const geo = (f: VideoFormat): L => { const { w, h } = FORMATS[f]; return { W: w, H: h, v: h > w * 1.3, cx: w / 2 }; };

// ---------------- text ----------------
const pathCache = new WeakMap<Font, Map<string, Path2D>>();
function glyphs(f: Font, s: string, size: number, anchor: "start" | "middle" | "end") {
  let m = pathCache.get(f);
  if (!m) { m = new Map(); pathCache.set(f, m); }
  const k = `${anchor}|${size}|${s}`;
  let p = m.get(k);
  if (!p) { p = new Path2D(textD(f, s, 0, 0, size, anchor) || "M0 0"); if (m.size > 500) m.clear(); m.set(k, p); }
  return p;
}
function txt(ctx: Ctx, f: Font, s: string, x: number, y: number, size: number, fill: string, anchor: "start" | "middle" | "end" = "start", alpha = 1) {
  if (!s || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.fillStyle = fill;
  ctx.fill(glyphs(f, s, Math.round(size), anchor));
  ctx.restore();
}
/** Wrapped, size-fitted lines; returns the height used. `y` is the top of the block. */
function block(ctx: Ctx, f: Font, s: string, x: number, y: number, o: { max: number; min: number; maxW: number; maxH: number; lh?: number; lines?: number }, fill: string, anchor: "start" | "middle" | "end" = "start", alpha = 1) {
  const lh = o.lh ?? 1;
  const T = fitBlock(f, s, { max: o.max, min: o.min, maxW: o.maxW, maxH: o.maxH, lh, maxLines: o.lines ?? 2 });
  const cap = capHeight(f) * T.size;
  T.lines.forEach((ln, i) => txt(ctx, f, ln, x, y + cap + i * T.size * lh, T.size, fill, anchor, alpha));
  return cap + (T.lines.length - 1) * T.size * lh;
}

// ---------------- drawing pieces ----------------
const grainPatterns = new WeakMap<object, CanvasPattern | null>();
function paper(ctx: Ctx, l: L, A: VideoAssets, color: string, grainAlpha = 0.55) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, l.W, l.H);
  let pat = grainPatterns.get(ctx);
  if (pat === undefined) { pat = ctx.createPattern(A.grain, "repeat"); grainPatterns.set(ctx, pat); }
  if (pat) { ctx.save(); ctx.globalAlpha = grainAlpha; ctx.fillStyle = pat; ctx.fillRect(0, 0, l.W, l.H); ctx.restore(); }
}
function fit(iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const k = Math.min(w / iw, h / ih);
  return { x: x + (w - iw * k) / 2, y: y + (h - ih * k) / 2, w: iw * k, h: ih * k };
}
/** Draws `img` covering the frame, zoomed by `zoom` around focus point (fx, fy) in the image (0..1). */
function cover(ctx: Ctx, l: L, s: Shot | Piece, fx: number, fy: number, zoom = 1) {
  const k = Math.max(l.W / s.iw, l.H / s.ih) * zoom;
  const dw = s.iw * k, dh = s.ih * k;
  const x = clamp(l.W / 2 - fx * dw, l.W - dw, 0), y = clamp(l.H / 2 - fy * dh, l.H - dh, 0);
  ctx.drawImage(s.img, x, y, dw, dh);
}
/** The painting in a white mat with a soft shadow (and a thin frame when `frame` is a color). */
function framed(ctx: Ctx, p: Piece, r: { x: number; y: number; w: number; h: number }, o: { mat?: number; frame?: string | null; fw?: number; rot?: number; alpha?: number; shadow?: number } = {}) {
  const mat = o.mat ?? 16, fw = o.frame ? o.fw ?? 10 : 0, a = o.alpha ?? 1;
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
  if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);
  const ow = r.w + 2 * (mat + fw), oh = r.h + 2 * (mat + fw);
  ctx.save();
  ctx.shadowColor = "rgba(21,22,27,.32)";
  ctx.shadowBlur = o.shadow ?? 36;
  ctx.shadowOffsetY = (o.shadow ?? 36) * 0.45;
  ctx.fillStyle = o.frame || "#ffffff";
  ctx.fillRect(-ow / 2, -oh / 2, ow, oh);
  ctx.restore();
  if (fw) { ctx.fillStyle = "#ffffff"; ctx.fillRect(-ow / 2 + fw, -oh / 2 + fw, ow - 2 * fw, oh - 2 * fw); }
  ctx.drawImage(p.img, -r.w / 2, -r.h / 2, r.w, r.h);
  ctx.restore();
}
function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 3) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}
/** A label on a pill. Returns its width. */
function chip(ctx: Ctx, A: VideoAssets, s: string, x: number, y: number, size: number, bg: string, fg: string, alpha = 1, anchor: "start" | "middle" = "start") {
  if (!s || alpha <= 0) return 0;
  const f = A.fonts.semi, w = width(f, s, size) + size * 1.3, h = size * 1.9;
  const x0 = anchor === "middle" ? x - w / 2 : x;
  ctx.save();
  ctx.globalAlpha *= alpha;
  rrect(ctx, x0, y, w, h, h / 2, bg);
  txt(ctx, f, s, x0 + size * 0.65, y + h / 2 + capHeight(f) * size / 2, size, fg);
  ctx.restore();
  return w;
}
function brandMark(ctx: Ctx, A: VideoAssets, x: number, y: number, size: number, ink: string, alpha = 1) {
  const f = A.fonts.display, b = size * 0.95, k = b / 24, top = y - capHeight(f) * size - b * 0.06;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, top); ctx.scale(k, k);
  ctx.strokeStyle = ink; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.roundRect(1, 1, 22, 22, 3.5); ctx.stroke();
  ctx.fillStyle = "#8b2a4b"; ctx.beginPath(); ctx.roundRect(8.25, 8.25, 7.5, 7.5, 1.6); ctx.fill();
  ctx.restore();
  txt(ctx, f, "artfinity", x + b + size * 0.32, y, size, ink, "start", alpha);
}
/** Dark gradient from `y0` to the bottom, so white words read over a photo. */
function shade(ctx: Ctx, l: L, y0: number, alpha: number) {
  if (alpha <= 0) return;
  const g = ctx.createLinearGradient(0, y0, 0, l.H);
  g.addColorStop(0, "rgba(21,22,27,0)"); g.addColorStop(0.5, "rgba(21,22,27,.55)"); g.addColorStop(1, "rgba(21,22,27,.85)");
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, y0, l.W, l.H - y0); ctx.restore();
}
/** Title and artist over a photo, lower third. */
function lowerThird(ctx: Ctx, l: L, A: VideoAssets, title: string, by: string, k: number) {
  const a = seg(k, 0, 0.35) * (1 - seg(k, 0.85, 1));
  if (a <= 0) return;
  shade(ctx, l, l.H * (l.v ? 0.55 : 0.45), a);
  const dy = (1 - easeOut(seg(k, 0, 0.3))) * 30;
  const top = l.H - (l.v ? 470 : 300) + dy;
  const h = block(ctx, A.fonts.display, title, 80, top, { max: l.v ? 104 : 84, min: 56, maxW: l.W - 160, maxH: l.v ? 210 : 170, lh: 0.95 }, "#ffffff", "start", a);
  txt(ctx, A.fonts.body, by, 80, top + h + 62, l.v ? 40 : 34, "#ffffff", "start", a * 0.88);
}

/**
 * The buy card: QR code, "Scan or tap to buy", the price and the handle. Placed at the bottom (or centered when
 * `center`). k: 0..1 entrance.
 */
function buyCard(ctx: Ctx, l: L, A: VideoAssets, S: VideoSpec, price: string, k: number, o: { center?: boolean; y?: number; noPrice?: boolean } = {}) {
  const F = A.fonts, a = seg(k, 0, 0.35);
  if (a <= 0) return;
  const pop = back(seg(k, 0, 0.6));
  const cw = l.W - 120, ch = l.v ? 400 : 300;
  const y = o.y ?? (o.center ? (l.H - ch) / 2 : l.H - ch - (l.v ? 150 : 60));
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(l.cx, y + ch / 2); ctx.scale(lerp(0.92, 1, pop), lerp(0.92, 1, pop)); ctx.translate(-l.cx, -(y + ch / 2));
  ctx.save(); ctx.shadowColor = "rgba(21,22,27,.25)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 14;
  rrect(ctx, 60, y, cw, ch, 32, "#ffffff");
  ctx.restore();
  const q = ch - 52;
  ctx.drawImage(A.qr, 86, y + 26, q, q);
  const tx = 86 + q + 34, tw = cw - q - 86;
  const ps = l.v ? 44 : 38;
  let cy = y + (l.v ? 70 : 44);
  if (!o.noPrice) {
    const pw = Math.min(tw, width(F.semi, price, ps) + 40);
    rrect(ctx, tx - 8, y + (l.v ? 52 : 34), pw, ps * 1.7, 14, S.brand.accent);
    txt(ctx, F.semi, price, tx + 12, y + (l.v ? 52 : 34) + ps * 0.85 + capHeight(F.semi) * ps / 2, ps, "#15161b");
    cy = y + (l.v ? 52 : 34) + ps * 1.7 + (l.v ? 34 : 22);
  }
  const h = block(ctx, F.display, S.text.cta, tx, cy, { max: l.v ? 62 : 50, min: 34, maxW: tw - 30, maxH: l.v ? 140 : 100, lh: 1 }, "#15161b");
  txt(ctx, F.semi, S.text.handle, tx, cy + h + (l.v ? 56 : 46), S.text.handle.length > 28 ? 24 : 28, "#5a5d6b");
  ctx.restore();
}

/** Closing scene shared by most presets: the brand color, the piece, its title, then the buy card. */
function closing(ctx: Ctx, l: L, A: VideoAssets, S: VideoSpec, p: Piece, k: number) {
  paper(ctx, l, A, S.brand.bg);
  const ink = S.brand.ink;
  brandMark(ctx, A, 80, l.v ? 140 : 100, l.v ? 38 : 32, ink, seg(k, 0, 0.2));
  const box = l.v ? { x: 150, y: 210, w: l.W - 300, h: 760 } : { x: 330, y: 150, w: 420, h: 400 };
  const pic = fit(p.iw, p.ih, box.x, box.y, box.w, box.h);
  const rise = (1 - easeOut(seg(k, 0.05, 0.35))) * 40;
  framed(ctx, p, { ...pic, y: pic.y + rise }, { mat: 14, rot: -1.2, alpha: seg(k, 0.05, 0.25) });
  const ty = (l.v ? box.y + box.h : box.y + box.h) + (l.v ? 70 : 50);
  block(ctx, A.fonts.display, p.title, l.cx, ty, { max: l.v ? 76 : 54, min: 40, maxW: l.W - 160, maxH: l.v ? 150 : 60, lh: 0.95, lines: l.v ? 2 : 1 }, ink, "middle", seg(k, 0.15, 0.35));
  buyCard(ctx, l, A, S, p.price, seg(k, 0.3, 1));
}

/** Last 1.5 s with a logo: the brand color, the logo popping in, the handle under it. */
function outro(ctx: Ctx, l: L, A: VideoAssets, S: VideoSpec, k: number) {
  paper(ctx, l, A, S.brand.bg, 0.4);
  const logo = A.logo;
  if (!logo) return;
  const s = back(seg(k, 0, 0.5));
  const box = fit(logo.w, logo.h, l.cx - 260, l.H / 2 - 300, 520, 420);
  ctx.save();
  ctx.globalAlpha = seg(k, 0, 0.25);
  ctx.translate(l.cx, box.y + box.h / 2); ctx.scale(lerp(0.8, 1, s), lerp(0.8, 1, s)); ctx.translate(-l.cx, -(box.y + box.h / 2));
  ctx.drawImage(logo.img, box.x, box.y, box.w, box.h);
  ctx.restore();
  txt(ctx, A.fonts.semi, S.text.handle, l.cx, l.H / 2 + 200, 40, S.brand.ink, "middle", seg(k, 0.25, 0.5));
}

// ---------------- 1. room tour ----------------
function roomTour(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0];
  const shots = A.scenes.length ? A.scenes : [{ img: p.img, iw: p.iw, ih: p.ih, label: "" } as Shot];
  const END = 9.6, FADE = 0.6, span = END / shots.length;
  if (t >= END) return closing(ctx, l, A, S, p, seg(t, END, END + 2.2));
  const draw = (i: number) => {
    const s = shots[i], u = clamp((t - i * span) / (span + FADE));
    // start off to one side of the room (alternating), drift onto the print and ease in until it fills about half the frame
    const [bx, by, bh] = s.box ? [(s.box[0] + s.box[2]) / 2, (s.box[1] + s.box[3]) / 2, s.box[3] - s.box[1]] : [0.5, 0.47, 0.4];
    const from = i % 2 ? Math.min(0.95, bx + 0.28) : Math.max(0.05, bx - 0.28);
    const zEnd = clamp((l.v ? 0.5 : 0.55) / bh, 1.06, 1.5);
    cover(ctx, l, s, lerp(from, bx, sine(u)), lerp(0.5, by, sine(u)), lerp(1.0, zEnd, sine(u)));
  };
  const i = Math.min(shots.length - 1, Math.floor(t / span));
  draw(i);
  const into = t - (i + 1) * span + FADE;
  if (i + 1 < shots.length && into > 0) { ctx.save(); ctx.globalAlpha = ease(clamp(into / FADE)); draw(i + 1); ctx.restore(); }
  const s = shots[i], lk = t - i * span;
  const la = seg(lk, 0.3, 0.7) * (1 - seg(lk, span - 0.3, span));
  const w = chip(ctx, A, s.label, 60, l.v ? 120 : 60, 30, "rgba(255,255,255,.92)", "#15161b", la);
  if (s.size) chip(ctx, A, s.size, 60 + w + 12, l.v ? 120 : 60, 30, S.brand.accent, "#15161b", la);
  lowerThird(ctx, l, A, p.title, `by ${S.text.artist}`, seg(t, 0.4, 3.6));
}

// ---------------- 2. close-up reveal ----------------
function closeup(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0];
  if (t >= 7.8) return closing(ctx, l, A, S, p, seg(t, 7.8, 10));
  paper(ctx, l, A, S.brand.bg);
  const box = l.v ? { x: 110, y: 360, w: l.W - 220, h: 1120 } : { x: 170, y: 110, w: l.W - 340, h: l.H - 300 };
  const pic = fit(p.iw, p.ih, box.x, box.y, box.w, box.h);
  const z = ease(seg(t, 2.2, 7.2));
  const words = () => {
    const a = seg(t, 0.4, 0.9) * (1 - seg(z, 0, 0.12));
    block(ctx, A.fonts.display, p.title, l.cx, l.v ? 170 : 40, { max: l.v ? 84 : 52, min: 44, maxW: l.W - 160, maxH: l.v ? 170 : 60, lh: 0.95, lines: l.v ? 2 : 1 }, S.brand.ink, "middle", a);
    if (l.v) txt(ctx, A.fonts.body, `by ${S.text.artist}`, l.cx, pic.y + pic.h + 110, 38, S.brand.ink, "middle", a * 0.8);
  };
  if (z <= 0) {
    framed(ctx, p, pic, { mat: 18, alpha: seg(t, 0, 0.5) });
    return words();
  }
  // camera: from the whole piece to 3.2× on its busiest spot
  const k0 = pic.w / p.iw, k1 = Math.max(l.W / p.iw, l.H / p.ih) * 3.2;
  const k = lerp(k0, k1, z);
  const fx = lerp(0.5, p.detail[0], z), fy = lerp(0.5, p.detail[1], z);
  const cy = lerp(pic.y + pic.h / 2, l.H / 2, z);
  const dw = p.iw * k, dh = p.ih * k;
  const x = l.cx - fx * dw, y = cy - fy * dh;
  ctx.save();
  ctx.globalAlpha = 1 - seg(z, 0, 0.15);
  framed(ctx, p, { x, y, w: dw, h: dh }, { mat: 18 * (k / k0) });
  ctx.restore();
  ctx.save(); ctx.globalAlpha = seg(z, 0, 0.15); ctx.drawImage(p.img, x, y, dw, dh); ctx.restore();
  words();
  chip(ctx, A, "Look closer", 60, l.v ? 120 : 60, 32, "rgba(255,255,255,.92)", "#15161b", seg(t, 3, 3.5) * (1 - seg(t, 6.6, 7.2)));
}

// ---------------- 3. price card ----------------
function priceCard(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0], F = A.fonts, ink = S.brand.ink;
  paper(ctx, l, A, S.brand.bg);
  brandMark(ctx, A, 80, l.v ? 140 : 90, l.v ? 38 : 30, ink, seg(t, 0, 0.5));
  const box = l.v ? { x: 140, y: 230, w: l.W - 280, h: 760 } : { x: 70, y: 170, w: 400, h: 560 };
  const pic = fit(p.iw, p.ih, box.x, box.y, box.w, box.h);
  // accent swatch sweeps in behind the piece
  const sw = easeOut(seg(t, 0.2, 1));
  ctx.save();
  ctx.translate(pic.x + pic.w / 2, pic.y + pic.h / 2); ctx.rotate((4 * Math.PI) / 180);
  ctx.beginPath(); ctx.rect(-pic.w, -pic.h, pic.w * 2 * sw, pic.h * 2); ctx.clip();
  rrect(ctx, -pic.w / 2 - 50, -pic.h / 2 + 24, pic.w + 100, pic.h + 30, 26, p.accent);
  ctx.restore();
  const float = Math.sin(t * 1.4) * 6;
  framed(ctx, p, { ...pic, y: pic.y + float + (1 - easeOut(seg(t, 0.3, 1.1))) * 50 }, { mat: 16, rot: -1.5, alpha: seg(t, 0.3, 0.8) });
  const tx = l.v ? 80 : 580, tw = l.v ? l.W - 160 : l.W - 640;
  let y = l.v ? box.y + box.h + 80 : 200;
  y += block(ctx, F.display, p.title, tx, y, { max: l.v ? 88 : 64, min: 44, maxW: tw, maxH: l.v ? 170 : 150, lh: 0.95 }, ink, "start", seg(t, 0.9, 1.4));
  txt(ctx, F.body, `by ${S.text.artist}`, tx, y + 60, l.v ? 38 : 32, ink, "start", seg(t, 1.1, 1.6) * 0.8);
  y += l.v ? 100 : 90;
  const ps = l.v ? 52 : 40, a2 = seg(t, 1.6, 2.1), pw = Math.min(tw, width(F.semi, p.price, ps) + 50);
  ctx.save(); ctx.globalAlpha = a2; rrect(ctx, tx - 10, y, pw * easeOut(a2), ps * 1.75, 16, S.brand.accent); ctx.restore();
  txt(ctx, F.semi, p.price, tx + 14, y + ps * 0.875 + capHeight(F.semi) * ps / 2, ps, "#15161b", "start", a2);
  if (l.v) buyCard(ctx, l, A, S, p.price, seg(t, 2.5, 3.6), { y: l.H - 470, noPrice: true });
  else {
    // square: code and buy line under the price
    const a3 = seg(t, 2.5, 3.1), qs = 200, qy = y + ps * 1.75 + 40;
    ctx.save(); ctx.globalAlpha = a3; rrect(ctx, tx - 10, qy, qs + 20, qs + 20, 18, "#ffffff"); ctx.drawImage(A.qr, tx, qy + 10, qs, qs); ctx.restore();
    block(ctx, F.display, S.text.cta, tx + qs + 34, qy + 40, { max: 42, min: 28, maxW: tw - qs - 34, maxH: 110, lh: 1 }, ink, "start", a3);
    block(ctx, F.semi, S.text.handle, tx, qy + qs + 50, { max: 26, min: 18, maxW: tw, maxH: 30, lines: 1 }, ink, "start", a3 * 0.8);
  }
}

// ---------------- 4. gallery walk ----------------
function galleryWalk(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const ps = A.pieces, F = A.fonts;
  if (t >= 10.8) return closing(ctx, l, A, S, ps[0], seg(t, 10.8, 13));
  // a long white wall with a floor; pieces hang at eye level with wall labels
  const wallH = l.v ? 1420 : 860, artH = l.v ? 640 : 420, eye = l.v ? 700 : 400, gap = l.v ? 260 : 220;
  const ws = ps.map((p) => Math.min(artH * (p.iw / p.ih), l.v ? 820 : 600));
  const total = ws.reduce((a, b) => a + b, 0) + gap * (ps.length - 1);
  const first = l.cx - ws[0] / 2, last = l.cx - (total - ws[ws.length - 1] / 2);
  const cam = lerp(0, last - first, ease(seg(t, 0.8, 10.4)));
  ctx.fillStyle = "#f4f2ec"; ctx.fillRect(0, 0, l.W, wallH);
  const g = ctx.createLinearGradient(0, 0, 0, wallH);
  g.addColorStop(0, "rgba(0,0,0,.06)"); g.addColorStop(0.3, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.05)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, l.W, wallH);
  ctx.fillStyle = "#b99c79"; ctx.fillRect(0, wallH, l.W, l.H - wallH);
  ctx.fillStyle = "#e9e5dc"; ctx.fillRect(0, wallH - 18, l.W, 18);
  // floor boards drift faster than the wall (parallax)
  ctx.strokeStyle = "rgba(60,40,20,.18)"; ctx.lineWidth = 3;
  for (let i = -2; i < 14; i++) {
    const x = ((i * 220 + (first + cam) * 1.3) % 2200 + 2200) % 2200 - 300;
    ctx.beginPath(); ctx.moveTo(x, wallH); ctx.lineTo(x - 260, l.H); ctx.stroke();
  }
  let x = first + cam;
  ps.forEach((p, i) => {
    const w = ws[i], h = w / (p.iw / p.ih);
    if (x + w > -200 && x < l.W + 200) {
      // ceiling spotlight
      const sg = ctx.createRadialGradient(x + w / 2, eye - h / 2 - 80, 10, x + w / 2, eye, w);
      sg.addColorStop(0, "rgba(255,248,230,.55)"); sg.addColorStop(1, "rgba(255,248,230,0)");
      ctx.fillStyle = sg; ctx.fillRect(x - w, 0, w * 3, wallH);
      framed(ctx, p, { x, y: eye - h / 2, w, h }, { mat: 12, frame: "#1c1d22", fw: 9, shadow: 30 });
      const ly = eye + h / 2 + 70;
      rrect(ctx, x, ly, Math.min(w, 380), 120, 6, "#ffffff", "rgba(0,0,0,.08)", 2);
      block(ctx, F.semi, p.title, x + 20, ly + 18, { max: 30, min: 22, maxW: Math.min(w, 380) - 40, maxH: 34, lines: 1 }, "#15161b");
      txt(ctx, F.body, p.price, x + 20, ly + 94, 24, "#5a5d6b");
    }
    x += w + gap;
  });
  const ha = seg(t, 0.2, 0.8) * (1 - seg(t, 3.5, 4.2));
  if (ha > 0) {
    const head = S.text.headline || `Works by ${S.text.artist}`;
    chip(ctx, A, head, l.cx, l.v ? 130 : 50, l.v ? 40 : 32, S.brand.ink, "#ffffff", ha, "middle");
  }
}

// ---------------- 5. before / after ----------------
function beforeAfter(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0];
  if (t >= 6.8) return closing(ctx, l, A, S, p, seg(t, 6.8, 9));
  const before = A.before, after = A.after;
  if (!before || !after) return closing(ctx, l, A, S, p, 1);
  const zoom = lerp(1.0, 1.08, t / 6.8);
  const b = after.box;
  const fx = b ? (b[0] + b[2]) / 2 : 0.5, fy = b ? (b[1] + b[3]) / 2 : 0.45;
  const wipeK = ease(seg(t, 2.4, 4.4));
  cover(ctx, l, before, fx, fy, zoom);
  if (wipeK > 0) {
    const edge = l.W * wipeK;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, edge, l.H); ctx.clip(); cover(ctx, l, after, fx, fy, zoom); ctx.restore();
    if (wipeK < 1) {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(edge - 4, 0, 8, l.H);
      ctx.beginPath(); ctx.arc(edge, l.H / 2, 42, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.fillStyle = "#15161b"; ctx.beginPath();
      ctx.moveTo(edge - 26, l.H / 2); ctx.lineTo(edge - 10, l.H / 2 - 13); ctx.lineTo(edge - 10, l.H / 2 + 13); ctx.closePath();
      ctx.moveTo(edge + 26, l.H / 2); ctx.lineTo(edge + 10, l.H / 2 - 13); ctx.lineTo(edge + 10, l.H / 2 + 13); ctx.closePath(); ctx.fill();
    }
  }
  const y = l.v ? 120 : 60;
  chip(ctx, A, "Before", 60, y, 38, "rgba(255,255,255,.94)", "#15161b", seg(t, 0.2, 0.6) * (1 - seg(t, 2.4, 2.8)));
  chip(ctx, A, "After", 60, y, 38, S.brand.accent, "#15161b", seg(t, 4.2, 4.6));
  lowerThird(ctx, l, A, p.title, after.size ? `${after.size} print · by ${S.text.artist}` : `by ${S.text.artist}`, seg(t, 4.4, 6.8));
}

// ---------------- 6. size compare ----------------
function sizeCompare(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0];
  const shots = A.sizes;
  const END = 8.8;
  if (t >= END || !shots.length) return closing(ctx, l, A, S, p, seg(t, END, END + 2.2));
  const span = END / shots.length, FADE = 0.35;
  const i = Math.min(shots.length - 1, Math.floor(t / span));
  const zoom = lerp(1.04, 1.0, t / END);
  // keep the print (and the sofa or person beside it) in frame: aim at the largest print's box
  const big = shots[shots.length - 1].box;
  const fx = big ? (big[0] + big[2]) / 2 : 0.5, fy = big ? Math.min(0.6, (big[1] + big[3]) / 2 + 0.08) : 0.5;
  cover(ctx, l, shots[i], fx, fy, zoom);
  const into = t - (i + 1) * span + FADE;
  if (i + 1 < shots.length && into > 0) { ctx.save(); ctx.globalAlpha = clamp(into / FADE); cover(ctx, l, shots[i + 1], fx, fy, zoom); ctx.restore(); }
  // the size, big, with a little bounce on each change
  const lk = t - i * span, pop = back(seg(lk, 0, 0.45));
  const size = shots[i].size || "";
  const F = A.fonts, y = l.v ? 150 : 70;
  ctx.save();
  ctx.translate(l.cx, y + 50); ctx.scale(lerp(0.85, 1, pop), lerp(0.85, 1, pop)); ctx.translate(-l.cx, -(y + 50));
  const sw = width(F.display, size, l.v ? 84 : 64) + 70;
  rrect(ctx, l.cx - sw / 2, y, sw, l.v ? 130 : 100, 24, S.brand.accent);
  txt(ctx, F.display, size, l.cx, y + (l.v ? 65 : 50) + capHeight(F.display) * (l.v ? 84 : 64) / 2, l.v ? 84 : 64, "#15161b", "middle");
  ctx.restore();
  // the dots: which of the sizes this is
  shots.forEach((_, j) => { ctx.beginPath(); ctx.arc(l.cx + (j - (shots.length - 1) / 2) * 34, y + (l.v ? 170 : 130), j === i ? 10 : 7, 0, Math.PI * 2); ctx.fillStyle = j === i ? "#ffffff" : "rgba(255,255,255,.55)"; ctx.fill(); });
  if (A.sizeNote) {
    shade(ctx, l, l.H * 0.72, 1);
    txt(ctx, F.semi, A.sizeNote, l.cx, l.H - (l.v ? 150 : 70), l.v ? 36 : 30, "#ffffff", "middle", seg(t, 0.4, 1));
  }
}

// ---------------- 7. collection carousel ----------------
function carousel(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const ps = A.pieces, F = A.fonts, ink = S.brand.ink;
  const INTRO = 1.6, END = 10;
  if (t >= END) return closing(ctx, l, A, S, ps[0], seg(t, END, 12));
  paper(ctx, l, A, S.brand.bg);
  const head = S.text.headline || `${S.text.artist}: the collection`;
  if (t < INTRO + 0.4) {
    const a = seg(t, 0.1, 0.5) * (1 - seg(t, INTRO, INTRO + 0.4));
    const h = block(ctx, F.display, head, l.cx, l.H / 2 - 120, { max: l.v ? 120 : 96, min: 60, maxW: l.W - 140, maxH: 300, lh: 0.95, lines: 3 }, ink, "middle", a);
    txt(ctx, F.body, `${ps.length} pieces · by ${S.text.artist}`, l.cx, l.H / 2 - 120 + h + 80, 40, ink, "middle", a * 0.8);
  }
  const span = (END - INTRO) / ps.length;
  const box = l.v ? { y: 300, h: 980 } : { y: 120, h: 700 };
  ps.forEach((p, i) => {
    const s = INTRO + i * span;
    const kin = ease(seg(t, s - 0.25, s + 0.45)), kout = ease(seg(t, s + span - 0.25, s + span + 0.45));
    if (kin <= 0 || kout >= 1) return;
    const off = (1 - kin) * l.W - kout * l.W;
    const pic = fit(p.iw, p.ih, 140 + off, box.y, l.W - 280, box.h);
    rrect(ctx, pic.x - 40, pic.y - 40, pic.w + 80, pic.h + (l.v ? 300 : 170), 28, "#ffffff");
    ctx.drawImage(p.img, pic.x, pic.y, pic.w, pic.h);
    const ty = pic.y + pic.h + 40;
    block(ctx, F.display, p.title, pic.x, ty, { max: l.v ? 64 : 44, min: 34, maxW: pic.w, maxH: l.v ? 130 : 50, lh: 0.95, lines: l.v ? 2 : 1 }, "#15161b");
    txt(ctx, F.semi, p.price, pic.x, ty + (l.v ? 190 : 100), l.v ? 34 : 28, "#5a5d6b");
  });
  if (t > INTRO) {
    const cur = Math.min(ps.length - 1, Math.floor((t - INTRO) / span));
    ps.forEach((_, j) => { ctx.beginPath(); ctx.arc(l.cx + (j - (ps.length - 1) / 2) * 30, l.H - (l.v ? 200 : 60), j === cur ? 9 : 6, 0, Math.PI * 2); ctx.fillStyle = j === cur ? ink : "rgba(21,22,27,.25)"; ctx.fill(); });
    chip(ctx, A, head, l.cx, l.v ? 140 : 40, l.v ? 32 : 26, ink, "#ffffff", seg(t, INTRO, INTRO + 0.4), "middle");
  }
}

// ---------------- 8. new drop countdown ----------------
export function daysUntil(date: string | undefined, now = new Date()): number {
  if (!date) return 3;
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 3;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.max(0, Math.round((d.getTime() - today.getTime()) / 86_400_000));
}
export function dropLabel(date: string | undefined) {
  if (!date) return "";
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function countdown(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0], F = A.fonts;
  if (t >= 8) return closing(ctx, l, A, { ...S, text: { ...S.text, cta: S.text.dropDate ? `Drops ${dropLabel(S.text.dropDate)}. Scan to see it first` : S.text.cta } }, p, seg(t, 8, 10));
  const reveal = ease(seg(t, 5.6, 7.2));
  cover(ctx, l, { img: p.soft || p.img, iw: p.iw, ih: p.ih, label: "" }, 0.5, 0.5, 1.15);
  if (reveal > 0) {
    ctx.save(); ctx.globalAlpha = reveal;
    paper(ctx, l, A, S.brand.bg);
    const pic = fit(p.iw, p.ih, 110, l.v ? 330 : 120, l.W - 220, l.v ? 1000 : l.H - 260);
    framed(ctx, p, pic, { mat: 16 });
    ctx.restore();
    block(ctx, F.display, p.title, l.cx, l.v ? 140 : 30, { max: l.v ? 80 : 50, min: 40, maxW: l.W - 160, maxH: l.v ? 160 : 56, lh: 0.95, lines: l.v ? 2 : 1 }, S.brand.ink, "middle", reveal);
    return;
  }
  ctx.fillStyle = "rgba(21,22,27,.35)"; ctx.fillRect(0, 0, l.W, l.H);
  const days = daysUntil(S.text.dropDate);
  // tick down from days + 3 to days over the first 4 seconds
  const ticks = 3, step = Math.min(ticks, Math.floor(seg(t, 0.8, 4.4) * (ticks + 0.999)));
  const n = days + ticks - step;
  const head = S.text.headline || "New drop";
  chip(ctx, A, head, l.cx, l.v ? 260 : 70, l.v ? 44 : 34, S.brand.accent, "#15161b", seg(t, 0.1, 0.5), "middle");
  const cy = l.H / 2;
  const R = l.v ? 300 : 230;
  ctx.save(); ctx.globalAlpha = seg(t, 0.2, 0.6);
  ctx.lineWidth = 22; ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.beginPath(); ctx.arc(l.cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "#ffffff"; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(l.cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * seg(t, 0.4, 5.4)); ctx.stroke();
  ctx.restore();
  const tick = (t - 0.8) % (3.6 / (ticks + 1));
  const bump = step < ticks ? back(clamp(tick / 0.35)) : 1;
  ctx.save(); ctx.translate(l.cx, cy); ctx.scale(lerp(0.7, 1, bump), lerp(0.7, 1, bump));
  txt(ctx, F.display, String(n), 0, capHeight(F.display) * (l.v ? 260 : 200) / 2, l.v ? 260 : 200, "#ffffff", "middle", seg(t, 0.3, 0.7));
  ctx.restore();
  txt(ctx, F.semi, n === 0 ? "today" : n === 1 ? "day to go" : "days to go", l.cx, cy + R + (l.v ? 110 : 80), l.v ? 52 : 40, "#ffffff", "middle", seg(t, 0.5, 0.9));
  const when = dropLabel(S.text.dropDate);
  if (when) txt(ctx, F.body, `Drops ${when}`, l.cx, cy + R + (l.v ? 180 : 130), l.v ? 40 : 32, "#ffffff", "middle", seg(t, 0.8, 1.2) * 0.9);
}

// ---------------- 9. seasonal frame ----------------
const SEASON_LOOK: Record<Season, { bg: string; ink: string; frame: string; parts: string[]; kind: "snow" | "leaf" | "petal" | "sun" | "lights" }> = {
  winter: { bg: "#dfe8ef", ink: "#1b2a3a", frame: "#ffffff", parts: ["#ffffff", "#f3f7fb"], kind: "snow" },
  holiday: { bg: "#1f3b2c", ink: "#fbf6ea", frame: "#b8955a", parts: ["#ffd43b", "#ff5a36", "#fff3c4"], kind: "lights" },
  spring: { bg: "#f6e8ea", ink: "#3b2430", frame: "#ffffff", parts: ["#f4a7b9", "#f9cbd6", "#ffffff"], kind: "petal" },
  summer: { bg: "#ffe3a3", ink: "#3a2a12", frame: "#ffffff", parts: ["#ffd43b", "#ff9f43"], kind: "sun" },
  fall: { bg: "#efe0cc", ink: "#3a2412", frame: "#5a3b22", parts: ["#c4572a", "#e09a3a", "#8c3b1c", "#d9b04a"], kind: "leaf" },
};
function particles(ctx: Ctx, l: L, t: number, look: (typeof SEASON_LOOK)[Season], front: boolean) {
  const n = look.kind === "sun" ? 0 : 34;
  for (let i = 0; i < n; i++) {
    if ((i % 2 === 0) !== front) continue;
    const r1 = hash(i, 1), r2 = hash(i, 2), r3 = hash(i, 3);
    const speed = look.kind === "snow" ? 90 + r2 * 80 : look.kind === "lights" ? 0 : 120 + r2 * 90;
    const x = ((r1 * l.W + Math.sin(t * (0.8 + r3) + i) * 40) % l.W + l.W) % l.W;
    const y = look.kind === "lights" ? 0 : ((r3 * l.H + t * speed) % (l.H + 80)) - 40;
    const c = look.parts[i % look.parts.length];
    ctx.save();
    ctx.translate(x, y);
    if (look.kind === "snow") { ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.arc(0, 0, 5 + r2 * 9, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill(); }
    else if (look.kind === "lights") { /* drawn as a garland below */ }
    else {
      ctx.rotate(t * (r2 - 0.5) * 3 + i);
      ctx.fillStyle = c;
      ctx.beginPath();
      if (look.kind === "leaf") { ctx.ellipse(0, 0, 22 + r1 * 10, 11 + r3 * 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.2)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.stroke(); }
      else { ctx.ellipse(0, 0, 13 + r1 * 6, 8 + r3 * 4, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  if (look.kind === "lights" && front) {
    // a string of lights across the top, twinkling
    for (let row = 0; row < 2; row++) {
      const base = row ? l.H - (l.v ? 120 : 70) : l.v ? 90 : 50;
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = -20; x <= l.W + 20; x += 20) { const y = base + Math.sin(x / 90) * 18; if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      for (let k = 0; k < 14; k++) {
        const x = 40 + k * (l.W - 80) / 13, y = base + Math.sin(x / 90) * 18 + 14;
        const tw = 0.55 + 0.45 * Math.sin(t * 4 + k * 1.7 + row);
        ctx.save(); ctx.globalAlpha = tw; ctx.shadowColor = look.parts[k % 3]; ctx.shadowBlur = 24;
        ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fillStyle = look.parts[k % 3]; ctx.fill(); ctx.restore();
      }
    }
  }
  if (look.kind === "sun" && !front) {
    ctx.save(); ctx.translate(l.W * 0.82, l.v ? 260 : 150); ctx.rotate(t * 0.15);
    for (let k = 0; k < 14; k++) { ctx.rotate((Math.PI * 2) / 14); ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(l.W * 1.4, -60); ctx.lineTo(l.W * 1.4, 60); ctx.closePath(); ctx.fill(); }
    ctx.beginPath(); ctx.arc(0, 0, 120, 0, Math.PI * 2); ctx.fillStyle = "#ffd43b"; ctx.fill();
    ctx.restore();
  }
}
function seasonal(ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) {
  const p = A.pieces[0], F = A.fonts;
  const season = S.text.season || "winter";
  const look = SEASON_LOOK[season];
  if (t >= 7.8) return closing(ctx, l, A, { ...S, brand: { ...S.brand, bg: look.bg, ink: look.ink } }, p, seg(t, 7.8, 10));
  paper(ctx, l, A, look.bg, 0.4);
  particles(ctx, l, t, look, false);
  const line = S.text.headline || SEASONS[season].line;
  const ty = l.v ? 200 : 60;
  const h = block(ctx, F.display, line, l.cx, ty, { max: l.v ? 92 : 60, min: 46, maxW: l.W - 160, maxH: l.v ? 190 : 70, lh: 0.95, lines: l.v ? 2 : 1 }, look.ink, "middle", seg(t, 0.2, 0.8));
  const box = l.v ? { x: 150, y: ty + h + 110, w: l.W - 300, h: 1000 } : { x: 230, y: ty + h + 50, w: l.W - 460, h: l.H - ty - h - 160 };
  const pic = fit(p.iw, p.ih, box.x, box.y, box.w, box.h);
  const sway = Math.sin(t * 1.1) * 1.2;
  framed(ctx, p, { ...pic, y: pic.y + (1 - easeOut(seg(t, 0.4, 1.4))) * 60 }, { mat: 20, frame: look.frame, fw: 16, rot: sway, alpha: seg(t, 0.4, 1) });
  txt(ctx, F.semi, `${p.title} · ${p.price}`, l.cx, pic.y + pic.h + (l.v ? 110 : 70), l.v ? 34 : 28, look.ink, "middle", seg(t, 1.2, 1.8));
  particles(ctx, l, t, look, true);
}

// ---------------- entry ----------------
const DRAW: Record<PresetId, (ctx: Ctx, l: L, t: number, A: VideoAssets, S: VideoSpec) => void> = {
  "room-tour": roomTour,
  closeup,
  "price-card": priceCard,
  "gallery-walk": galleryWalk,
  "before-after": beforeAfter,
  "size-compare": sizeCompare,
  carousel,
  countdown,
  seasonal,
};

/** One frame at time `t` (seconds), in full-size pixels. Scale the context first for a smaller preview. */
export function drawFrame(ctx: Ctx, S: VideoSpec, A: VideoAssets, t: number) {
  const l = geo(S.format);
  const base = presetOf(S.preset).duration;
  t = Math.max(0, t || 0);
  ctx.save();
  if (A.logo && t >= base) outro(ctx, l, A, S, seg(t, base, base + OUTRO_SECONDS));
  else DRAW[S.preset](ctx, l, Math.min(t, base), A, S);
  ctx.restore();
}
