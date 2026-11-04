// QR Studio card faces, drawn as one SVG each (text outlined), in points (72 per inch).
// The same function feeds the live preview, the SVG download and the print PDF.
import { qrSVG, qrMatrix, type DotStyle, type EyeStyle } from "@/lib/qr/render";
import { basePrices } from "@/lib/artwork_price";
import { money, type SizeKey } from "@/lib/earnings";
import { type Fonts, text, fit, fitBlock, capHeight, width, arcText, arcWidth, blockH } from "./text";

// ---------------- options ----------------
export type FormatKey = "label" | "sticker" | "tag" | "poster";
export type CtaKey = "buy-painting" | "buy-print" | "scan-buy" | "custom";
export type PresetKey = "gallery" | "sticker" | "market" | "poster";
export type EndKey = "never" | "event" | "30";

export const CTAS: [CtaKey, string][] = [["buy-painting", "Buy this painting"], ["buy-print", "Buy a print"], ["scan-buy", "Scan to buy"], ["custom", "Your own"]];

type Sheet = { cols: number; rows: number; gx: number; gy: number; note: string };
export const FORMATS: Record<FormatKey, { name: string; w: number; h: number; sheet: Sheet }> = {
  label: { name: "Wall label", w: 3.5, h: 2, sheet: { cols: 2, rows: 5, gx: 0, gy: 0, note: "10 per sheet. Standard business-card layout." } },
  sticker: { name: "Round sticker", w: 2, h: 2, sheet: { cols: 3, rows: 4, gx: 0.5, gy: 0.5, note: "12 per sheet. Fits 2 in round labels." } },
  tag: { name: "Hang tag", w: 2, h: 3.5, sheet: { cols: 4, rows: 3, gx: 0, gy: 0, note: "12 per sheet. Punch the hole after cutting." } },
  poster: { name: "Poster", w: 8.5, h: 11, sheet: { cols: 1, rows: 1, gx: 0, gy: 0, note: "One per sheet. Print at 11 × 17 in to scan from twice as far." } },
};
export const DOTS: Record<DotStyle, string> = { square: "Square", rounded: "Soft", dots: "Dots", liquid: "Liquid", lines: "Lines", diamond: "Diamond" };
export const EYES: Record<EyeStyle, string> = { frame: "Frame mark", square: "Square", rounded: "Rounded", circle: "Circle" };
export const FG = ["#15161b", "#2b37f0", "#0f7a55", "#7b2d8e", "#b8321c", "#ffffff"];
export const BG = ["#ffffff", "#f2f3ec", "#ffd43b", "#ffd6cc", "#d4e6ff", "#15161b"];
export const TAG = ["#ffd43b", "#ff5a36", "#2b37f0", "#0f7a55", "#15161b", "#ffffff"];
export const EYE = ["same", "#2b37f0", "#ff5a36", "#0f7a55"];
export const COLOR_NAMES: Record<string, string> = {
  "#15161b": "Ink", "#2b37f0": "Scan blue", "#0f7a55": "Green", "#7b2d8e": "Plum", "#b8321c": "Brick", "#ffffff": "White",
  "#f2f3ec": "Wall white", "#ffd43b": "Sticker yellow", "#ffd6cc": "Blush", "#d4e6ff": "Sky", "#ff5a36": "Coral", same: "Same as code",
};
export const DISCOUNTS = [0, 10, 15, 20, 25];

type Look = { format: FormatKey; cta: CtaKey; dots: DotStyle; eyes: EyeStyle; fg: string; bg: string; eye: string; tag: string };
export const PRESETS: Record<PresetKey, Look & { name: string; sub: string }> = {
  gallery: { name: "Gallery label", sub: "Beside the painting", format: "label", cta: "buy-print", dots: "rounded", eyes: "frame", fg: "#15161b", bg: "#ffffff", eye: "#2b37f0", tag: "#ffd43b" },
  sticker: { name: "Sticker", sub: "Round and loud", format: "sticker", cta: "scan-buy", dots: "dots", eyes: "circle", fg: "#15161b", bg: "#ffd43b", eye: "same", tag: "#15161b" },
  market: { name: "Market tag", sub: "Hangs off a frame", format: "tag", cta: "buy-painting", dots: "square", eyes: "rounded", fg: "#15161b", bg: "#ffffff", eye: "#ff5a36", tag: "#ff5a36" },
  poster: { name: "Show poster", sub: "Door or easel", format: "poster", cta: "scan-buy", dots: "liquid", eyes: "frame", fg: "#2b37f0", bg: "#f2f3ec", eye: "same", tag: "#ffd43b" },
};

export type Design = Look & {
  preset: PresetKey | "custom";
  ctaCustom: string;
  showTitle: boolean;
  showPrice: boolean;
  showBrand: boolean;
  disc: number;
  coupon: string;
  ev: string;
  evPrint: boolean;
  size: SizeKey;
  end: EndKey;
};

export function presetLook(k: PresetKey): Look {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, sub, ...look } = PRESETS[k];
  return look;
}

export const DEFAULT_DESIGN: Design = {
  preset: "gallery", ...presetLook("gallery"),
  ctaCustom: "Take me home", showTitle: true, showPrice: true, showBrand: true,
  disc: 10, coupon: "SCAN10", ev: "", evPrint: false, size: "medium", end: "never",
};

export type ArtInfo = { slug: string; title: string; artist: string; imageUrl: string; markups: Record<SizeKey, number>; sensitive?: string[] };

// ---------------- helpers ----------------
const HEX = /^#[0-9a-f]{6}$/i;
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : d);

/** Anything from a client becomes a valid Design. */
export function sanitizeDesign(input: unknown): Design {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const D = DEFAULT_DESIGN;
  return {
    preset: oneOf(i.preset, ["gallery", "sticker", "market", "poster", "custom"] as const, "custom"),
    format: oneOf(i.format, Object.keys(FORMATS) as FormatKey[], D.format),
    cta: oneOf(i.cta, CTAS.map((c) => c[0]), D.cta),
    ctaCustom: str(i.ctaCustom, 28, D.ctaCustom),
    showTitle: bool(i.showTitle, D.showTitle),
    showPrice: bool(i.showPrice, D.showPrice),
    showBrand: bool(i.showBrand, D.showBrand),
    disc: DISCOUNTS.includes(Number(i.disc)) ? Number(i.disc) : 0,
    coupon: str(i.coupon, 16),
    tag: color(i.tag, D.tag),
    dots: oneOf(i.dots, Object.keys(DOTS) as DotStyle[], D.dots),
    eyes: oneOf(i.eyes, Object.keys(EYES) as EyeStyle[], D.eyes),
    fg: color(i.fg, D.fg),
    bg: color(i.bg, D.bg),
    eye: i.eye === "same" ? "same" : color(i.eye, "same"),
    ev: str(i.ev, 32),
    evPrint: bool(i.evPrint, false),
    size: oneOf(i.size, ["small", "medium", "large", "xl"] as const, D.size),
    end: oneOf(i.end, ["never", "event", "30"] as const, D.end),
  };
}

export function lum(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4]
    .map((i) => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export const inkOn = (bg: string) => (lum(bg) > 0.36 ? "#15161b" : "#ffffff");
export const eyeColor = (d: Design) => (d.eye === "same" ? null : d.eye);

export function ctaText(d: Design) {
  if (d.cta === "custom") return d.ctaCustom.trim() || "Scan to buy";
  return CTAS.find((c) => c[0] === d.cta)?.[1] || "Scan to buy";
}

/** What the code holds, until short links exist: the artwork page plus scan context. */
export function qrValue(d: Pick<Design, "ev" | "disc">, slug: string, base: string) {
  const u = new URL(`/art/${encodeURIComponent(slug)}`, base);
  if (d.ev.trim()) u.searchParams.set("at", d.ev.trim());
  if (d.disc) u.searchParams.set("off", String(d.disc));
  return u.toString();
}

export const pricesFrom = (art: ArtInfo) => basePrices.small + (art.markups.small || 0);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (v: number) => +v.toFixed(2);

// ---------------- shared pieces ----------------
function qrAt(d: Design, qrText: string, x: number, y: number, size: number, title: string) {
  return qrSVG(qrText, { fg: d.fg, dots: d.dots, eyes: d.eyes, eyeColor: eyeColor(d), label: `QR code for ${title}` })
    .replace("<svg ", `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" `);
}

/** The Artfinity mark plus wordmark. y is the baseline. */
function brand(f: Fonts, x: number, y: number, size: number, ink: string, anchor: "start" | "middle" = "start") {
  const b = size * 0.95, gap = size * 0.32, tw = width(f.display, "artfinity", size);
  const total = b + gap + tw;
  const x0 = anchor === "middle" ? x - total / 2 : x;
  const k = b / 24, top = y - capHeight(f.display) * size - b * 0.06;
  return `<g><g transform="translate(${n2(x0)} ${n2(top)}) scale(${n2(k)})"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="none" stroke="${ink}" stroke-width="3"/><rect x="7" y="7" width="10" height="10" rx="1.5" fill="${ink}"/></g>` +
    text(f.display, "artfinity", x0 + b + gap, y, size, ink) + "</g>";
}
const brandWidth = (f: Fonts, size: number) => size * 1.27 + width(f.display, "artfinity", size);

/** Die-cut price tag (same shape as lib/qr/render tagSVG), text outlined. w is its width; height is w / 2. */
function priceTag(f: Fonts, pct: number, fill: string, ink: string, string: string, x: number, y: number, w: number, rot = 0) {
  const big = `${pct}% OFF`;
  const bs = Math.min(48, (48 * 126) / width(f.display, big, 48));
  const sub = "when you scan";
  const ss = Math.min(15, (15 * 112) / width(f.semi, sub, 15));
  return `<g transform="translate(${n2(x)} ${n2(y)}) scale(${n2(w / 200)}) rotate(${rot} 0 50)">` +
    `<path d="M46 50 C 34 30, 20 22, 3 27" fill="none" stroke="${string}" stroke-width="3" stroke-linecap="round"/>` +
    `<path fill="${fill}" fill-rule="evenodd" stroke="#000" stroke-opacity=".18" stroke-width="1.5" d="M60 4 H189 Q196 4 196 11 V89 Q196 96 189 96 H60 L20 50 Z M46 42 a8 8 0 1 0 0.01 0 Z"/>` +
    text(f.display, big, 128, 62, bs, ink, "middle") + text(f.semi, sub, 128, 84, ss, ink, "middle") + "</g>";
}

/** "Title · Artist" on one line, title in semibold. y is the baseline. */
function who(f: Fonts, art: ArtInfo, x: number, y: number, size: number, maxW: number, ink: string, anchor: "start" | "middle" = "start") {
  let rest = " · " + art.artist;
  let title = art.title;
  const rw = width(f.body, rest, size);
  if (width(f.semi, title, size) + rw > maxW) {
    title = fit(f.semi, title, size, Math.max(maxW * 0.55, maxW - rw));
    rest = fit(f.body, rest, size, maxW - width(f.semi, title, size));
  }
  const total = width(f.semi, title, size) + width(f.body, rest, size);
  const x0 = anchor === "middle" ? x - total / 2 : x;
  return text(f.semi, title, x0, y, size, ink) + text(f.body, rest, x0 + width(f.semi, title, size), y, size, ink, "start", 0.72);
}

export type Card = { inner: string; w: number; h: number; qrPt: number; ctaPt: number; label: string };

// ---------------- faces ----------------
export function renderCard(d: Design, art: ArtInfo, f: Fonts, qrText: string, uid = "c"): Card {
  const cta = ctaText(d);
  const ink = d.fg, tagInk = inkOn(d.tag);
  const price = d.showPrice ? `Prints from ${money(pricesFrom(art))}` : "";
  const ev = d.evPrint ? d.ev.trim() : "";
  const label = `${FORMATS[d.format].name}: ${cta}.${d.disc ? ` ${d.disc}% off when you scan.` : ""} ${art.title} by ${art.artist}.`;
  const dcap = capHeight(f.display), bcap = capHeight(f.body);

  if (d.format === "label") {
    const W = 252, H = 144, u = W / 100, pad = 5 * u;
    const Q = 37 * u, qx = W - pad - Q, qy = (H - Q) / 2;
    const x0 = pad, tw = qx - 4.5 * u - pad;
    let s = `<rect width="${W}" height="${H}" rx="${n2(2.4 * u)}" fill="${d.bg}"/>` + qrAt(d, qrText, qx, qy, Q, art.title);
    // footer, bottom up
    const fs = 3.1 * u, gap = 1.7 * u;
    let base = H - pad - 0.18 * fs, top = H - pad;
    if (d.showBrand || price) {
      const bs = 3.6 * u;
      if (d.showBrand) s += brand(f, x0, base, bs, ink);
      if (price) s += text(f.body, price, d.showBrand ? x0 + tw : x0, base, fs, ink, d.showBrand ? "end" : "start", 0.72);
      top = base - dcap * bs; base = top - gap - 0.18 * fs;
    }
    if (ev) { s += text(f.semi, fit(f.semi, ev, fs, tw), x0, base, fs, ink, "start", 0.72); top = base - bcap * fs; base = top - gap - 0.18 * fs; }
    if (d.showTitle) { s += who(f, art, x0, base, fs, tw, ink); top = base - bcap * fs; }
    // tag, then the words
    const tagW = 35 * u;
    let ctaTop = pad;
    if (d.disc) { s += priceTag(f, d.disc, d.tag, tagInk, ink, x0 - 0.8 * u, pad - 0.8 * u, tagW, -4); ctaTop = pad + tagW / 2 + 1.8 * u; }
    const blk = fitBlock(f.display, cta, { max: (d.disc ? 9.8 : 11) * u, min: 4.5 * u, maxW: tw, maxH: top - 3 * u - ctaTop, lh: 0.9, maxLines: 3 });
    let y = ctaTop + dcap * blk.size;
    for (const line of blk.lines) { s += text(f.display, line, x0, y, blk.size, ink); y += blk.size * 0.9; }
    return { inner: s, w: W, h: H, qrPt: Q, ctaPt: blk.size, label };
  }

  if (d.format === "sticker") {
    const S = 144, k = S / 200;
    let s = `<circle cx="100" cy="100" r="99" fill="${d.bg}" stroke="#000" stroke-opacity=".12" stroke-width="1"/>`;
    const up = cta.toUpperCase();
    const cs = Math.min(27, (27 * 168) / arcWidth(f.display, up, 27, 0.6));
    s += arcText(f.display, up, 100, 104, 72, cs, ink, 1, 0.6);
    s += qrAt(d, qrText, 55, 47, 90, art.title);
    if (d.disc) s += priceTag(f, d.disc, d.tag, tagInk, ink, 54, 139, 92);
    else {
      if (d.showTitle) {
        // Keep the bottom arc inside the lower quarter so it never touches the code.
        const maxW = 98;
        let line = `${art.title} · ${art.artist}`;
        if (arcWidth(f.semi, line, 9) > maxW) line = art.title;
        const ts = Math.max(8, Math.min(11, (11 * maxW) / arcWidth(f.semi, line, 11)));
        s += arcText(f.semi, fit(f.semi, line, ts, maxW), 100, 100, 70, ts, ink, -1, 0, 0.8);
      }
      if (d.showBrand) s += d.showTitle ? brand(f, 100, 152, 9.5, ink, "middle") : brand(f, 100, 160, 12, ink, "middle");
    }
    return { inner: `<g transform="scale(${k})">${s}</g>`, w: S, h: S, qrPt: 90 * k, ctaPt: cs * k, label };
  }

  if (d.format === "tag") {
    const W = 144, H = 252, u = W / 100, side = 8 * u, cw = W - 2 * side;
    const holeY = 9.5 * u, holeR = 4 * u, SH = d.disc ? 40 * u : 0, stubY = H - SH;
    let s = `<defs><mask id="qs-m-${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${W / 2}" cy="${n2(holeY)}" r="${n2(holeR)}" fill="#000"/>` +
      (d.disc ? `<circle cx="0" cy="${n2(stubY)}" r="${n2(5 * u)}" fill="#000"/><circle cx="${W}" cy="${n2(stubY)}" r="${n2(5 * u)}" fill="#000"/>` : "") + `</mask></defs>`;
    s += `<g mask="url(#qs-m-${uid})"><rect width="${W}" height="${H}" rx="${n2(6 * u)}" fill="${d.bg}"/>`;
    if (d.disc) s += `<path d="M0 ${n2(stubY)}H${W}V${H - 6 * u}a${n2(6 * u)} ${n2(6 * u)} 0 0 1 -${n2(6 * u)} ${n2(6 * u)}H${n2(6 * u)}a${n2(6 * u)} ${n2(6 * u)} 0 0 1 -${n2(6 * u)} -${n2(6 * u)}Z" fill="${d.tag}"/>` +
      `<line x1="0" x2="${W}" y1="${n2(stubY)}" y2="${n2(stubY)}" stroke="${d.bg}" stroke-width="${n2(0.9 * u)}" stroke-dasharray="${n2(2 * u)} ${n2(1.4 * u)}"/>`;
    s += `</g><circle cx="${W / 2}" cy="${n2(holeY)}" r="${n2(holeR)}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="${n2(0.7 * u)}"/>`;

    const top0 = 15 * u, gap = 4 * u;
    const ps = 4.8 * u;
    const limit = d.disc ? stubY - 3 * u : H - 7 * u - (price ? bcap * ps + 3 * u : 0);
    const bs = 5.6 * u, ws = 5 * u;
    const brandH = d.showBrand ? dcap * bs + gap : 0;
    const whoLines = (d.showTitle ? 2 : 0) + (ev ? 1 : 0);
    const whoH = whoLines ? bcap * ws + (whoLines - 1) * ws * 1.25 + gap : 0;
    let Q = 68 * u;
    let avail = limit - top0 - brandH - whoH - Q - gap;
    const blk = fitBlock(f.display, cta, { max: 15 * u, min: 8 * u, maxW: cw, maxH: Math.max(avail, 10 * u), lh: 0.9, maxLines: 3 });
    const ch = blockH(f.display, blk.lines.length, blk.size, 0.9);
    if (ch > avail) { Q = Math.max(54 * u, Q - (ch - avail)); avail = limit - top0 - brandH - whoH - Q - gap; }
    const extra = Math.max(0, avail - ch) / (whoLines ? 4 : 3);
    let y = top0 + extra * 0.5;
    if (d.showBrand) { y += dcap * bs; s += brand(f, W / 2, y, bs, ink, "middle"); y += gap + extra * 0.5; }
    y += dcap * blk.size;
    for (const line of blk.lines) { s += text(f.display, line, W / 2, y, blk.size, ink, "middle"); y += blk.size * 0.9; }
    y += -blk.size * 0.9 + gap + extra;
    s += qrAt(d, qrText, (W - Q) / 2, y, Q, art.title);
    y += Q + gap + extra;
    if (whoLines) {
      y += bcap * ws - ws * 1.25;
      if (d.showTitle) {
        y += ws * 1.25; s += text(f.semi, fit(f.semi, art.title, ws, cw), W / 2, y, ws, ink, "middle");
        y += ws * 1.25; s += text(f.body, fit(f.body, art.artist, ws, cw), W / 2, y, ws, ink, "middle", 0.72);
      }
      if (ev) { y += ws * 1.25; s += text(f.semi, fit(f.semi, ev, ws, cw), W / 2, y, ws, ink, "middle", 0.72); }
    }
    if (d.disc) {
      const ns = 27 * u, os = 12 * u, num = `${d.disc}%`;
      const nw = width(f.display, num, ns), ow = width(f.display, "OFF", os), gapO = 0.06 * ns;
      const x0 = W / 2 - (nw + gapO + ow) / 2, nb = stubY + 6 * u + dcap * ns;
      s += text(f.display, num, x0, nb, ns, tagInk) + text(f.display, "OFF", x0 + nw + gapO, nb, os, tagInk);
      s += text(f.semi, "when you scan this code", W / 2, H - 7 * u - 0.15 * ws, ws, tagInk, "middle");
    } else if (price) s += text(f.body, price, W / 2, H - 7 * u, ps, ink, "middle", 0.72);
    return { inner: s, w: W, h: H, qrPt: Q, ctaPt: blk.size, label };
  }

  // poster: words, then the tag, then a big code, then the small print
  const W = 612, H = 792, u = W / 100, pad = 8 * u, cw = W - 2 * pad;
  let s = `<rect width="${W}" height="${H}" fill="${d.bg}"/>`;
  // bottom block first, so the rest can share what is left
  const ws = 3.6 * u, lh = ws * 1.32, bsz = 4.4 * u;
  const brandW = d.showBrand ? brandWidth(f, bsz) + 4 * u : 0;
  const lines: [string, "semi" | "body", number][] = [];
  if (d.showTitle) { lines.push([art.title, "semi", 1]); lines.push([art.artist, "body", 0.72]); }
  if (ev) lines.push([ev, "body", 0.72]);
  if (price) lines.push([price, "body", 0.72]);
  const lastBase = H - pad - 0.2 * ws;
  lines.forEach(([t, fk, op], i) => {
    const fy = lastBase - (lines.length - 1 - i) * lh;
    s += text(f[fk], fit(f[fk], t, ws, cw - brandW), pad, fy, ws, ink, "start", op);
  });
  if (d.showBrand) s += brand(f, W - pad - brandWidth(f, bsz), H - pad - 0.2 * bsz, bsz, ink);
  const bottomTop = lines.length ? lastBase - (lines.length - 1) * lh - bcap * ws : H - pad - (d.showBrand ? dcap * bsz : 0);
  const gap = 4.5 * u, tagW = 46 * u, tagH = d.disc ? tagW / 2 : 0;
  let Q = 56 * u;
  const room = bottomTop - pad - gap * (d.disc ? 3 : 2) - tagH;
  const blk = fitBlock(f.display, cta, { max: 17 * u, min: 9 * u, maxW: cw, maxH: Math.min(34 * u, room - 48 * u), lh: 0.9, maxLines: 3 });
  const ch = blockH(f.display, blk.lines.length, blk.size, 0.9);
  Q = Math.max(40 * u, Math.min(Q, room - ch));
  const extra = Math.max(0, room - ch - Q) / (d.disc ? 4 : 3);
  let y = pad + dcap * blk.size;
  for (const line of blk.lines) { s += text(f.display, line, pad, y, blk.size, ink); y += blk.size * 0.9; }
  y += -blk.size * 0.9 + gap + extra;
  if (d.disc) { s += priceTag(f, d.disc, d.tag, tagInk, ink, pad - 1.5 * u, y - 1 * u, tagW, -4); y += tagH + gap + extra; }
  s += qrAt(d, qrText, (W - Q) / 2, y, Q, art.title);
  return { inner: s, w: W, h: H, qrPt: Q, ctaPt: blk.size, label };
}

/** A standalone SVG file at real print size. */
export function cardSVG(c: Card) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${c.w} ${c.h}" width="${n2(c.w / 72)}in" height="${n2(c.h / 72)}in" role="img" aria-label="${esc(c.label)}">${c.inner}</svg>`;
}

// ---------------- print sheet (US Letter) ----------------
export type SheetLayout = { W: number; H: number; cw: number; ch: number; slots: { x: number; y: number }[]; marks: [number, number, number, number][] };
export function sheetLayout(fmt: FormatKey): SheetLayout {
  const F = FORMATS[fmt], S = F.sheet, W = 612, H = 792;
  const cw = F.w * 72, ch = F.h * 72, gx = S.gx * 72, gy = S.gy * 72;
  const gw = S.cols * cw + (S.cols - 1) * gx, gh = S.rows * ch + (S.rows - 1) * gy;
  const x0 = (W - gw) / 2, y0 = (H - gh) / 2;
  const slots: SheetLayout["slots"] = [];
  for (let r = 0; r < S.rows; r++) for (let c = 0; c < S.cols; c++) slots.push({ x: x0 + c * (cw + gx), y: y0 + r * (ch + gy) });
  const marks: SheetLayout["marks"] = [];
  const off = 4;
  if (x0 > 10 && y0 > 10) {
    const xs = new Set<number>(), ys = new Set<number>();
    slots.forEach((p) => { xs.add(n2(p.x)); xs.add(n2(p.x + cw)); ys.add(n2(p.y)); ys.add(n2(p.y + ch)); });
    const lenY = Math.min(16, y0 - off - 2), lenX = Math.min(16, x0 - off - 2);
    xs.forEach((x) => { marks.push([x, y0 - off - lenY, x, y0 - off]); marks.push([x, y0 + gh + off, x, y0 + gh + off + lenY]); });
    ys.forEach((y) => { marks.push([x0 - off - lenX, y, x0 - off, y]); marks.push([x0 + gw + off, y, x0 + gw + off + lenX, y]); });
  }
  return { W, H, cw, ch, slots, marks };
}

export function sheetSVG(c: Card, fmt: FormatKey, uid = "s") {
  const L = sheetLayout(fmt);
  const id = `qs-card-${uid}`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="8.5in" height="11in" role="img" aria-label="Print sheet: ${L.slots.length} × ${esc(c.label)}">` +
    `<rect width="${L.W}" height="${L.H}" fill="#fff"/><defs><symbol id="${id}" viewBox="0 0 ${c.w} ${c.h}">${c.inner}</symbol></defs>`;
  for (const p of L.slots) s += `<use href="#${id}" x="${n2(p.x)}" y="${n2(p.y)}" width="${c.w}" height="${c.h}"/>`;
  if (L.marks.length) s += `<path stroke="#15161b" stroke-width=".5" fill="none" d="${L.marks.map((m) => `M${m[0]} ${m[1]}L${m[2]} ${m[3]}`).join("")}"/>`;
  return s + "</svg>";
}

// ---------------- scan maths ----------------
export function scanNumbers(c: Card, qrText: string, f: Fonts) {
  const n = qrMatrix(qrText).length;
  const qrIn = c.qrPt / 72, modIn = qrIn / (n + 4), codeIn = modIn * n;
  const capIn = (c.ctaPt * capHeight(f.display)) / 72;
  return { n, modMm: modIn * 25.4, codeIn, scanCm: codeIn * 2.54 * 10, readM: capIn * 3.05 };
}
export function fmtDist(cm: number) {
  return cm >= 100 ? (cm / 100).toFixed(1).replace(/\.0$/, "") + " m" : Math.round(cm / 5) * 5 + " cm";
}
