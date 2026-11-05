// QR Studio card faces, drawn as one SVG each (text outlined), in points (72 per inch).
// The same function feeds the live preview, the SVG download and the print PDF.
import { qrSVG, qrMatrix, type DotStyle, type EyeStyle } from "@/lib/qr/render";
import { MARK_BOX, markPaths } from "@/lib/brand/mark";
import { basePrices } from "@/lib/artwork_price";
import { money, type SizeKey } from "@/lib/earnings";
import { shortUrl } from "@/lib/shortcode";
import { artPath } from "@/lib/urls";
import { type Fonts, text, fit, fitBlock, capHeight, width, arcText, arcWidth, blockH } from "./text";

// ---------------- options ----------------
export type FormatKey = "label" | "sticker" | "tag" | "poster";
export type CtaKey = "buy-painting" | "buy-print" | "scan-buy" | "custom";
export type PresetKey = "gallery" | "sticker" | "market" | "poster";
export type EndKey = "never" | "event" | "30";

export const CTAS: [CtaKey, string][] = [["buy-painting", "Take a print home"], ["buy-print", "Buy a print"], ["scan-buy", "Scan to buy"], ["custom", "Your own"]];

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
  /** Artfinity mark in the middle of the code (switches the code to error correction H). */
  logo: boolean;
  disc: number;
  coupon: string;
  ev: string;
  evPrint: boolean;
  size: SizeKey;
  end: EndKey;
};

export function presetLook(k: PresetKey): Look {
  const { name, sub, ...look } = PRESETS[k];
  return look;
}

export const DEFAULT_DESIGN: Design = {
  preset: "gallery", ...presetLook("gallery"),
  ctaCustom: "Take me home", showTitle: true, showPrice: true, showBrand: true, logo: true,
  disc: 0, coupon: "", ev: "", evPrint: false, size: "medium", end: "never",
};

export type ArtInfo = { slug: string; title: string; artist: string; imageUrl: string; markups: Record<SizeKey, number>; sensitive?: string[]; edition?: number | null };

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
    logo: bool(i.logo, D.logo),
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

/**
 * The URL a code holds. With a saved short link `code`: `${base}/Q/${CODE}` in capitals (QR alphanumeric mode, the
 * smallest code), and everything behind it stays editable. Without one: the older signed artwork link, kept so codes
 * printed before short links still work (a discount only counts with its server-made signature `sig`, lib/scanSign.ts).
 * With the artist's `handle` that link is /@handle/art/<slug>; without it, the old /art/<slug> (which redirects there).
 */
export function qrValue(d: Pick<Design, "ev" | "disc">, slug: string, base: string, sig?: string | null, code?: string | null, handle?: string | null) {
  if (code) return shortUrl(code, base);
  const u = new URL(handle ? artPath(handle, slug) : `/art/${encodeURIComponent(slug)}`, base);
  if (d.ev.trim()) u.searchParams.set("at", d.ev.trim());
  if (d.disc) u.searchParams.set("off", String(d.disc));
  if (d.disc && sig) u.searchParams.set("s", sig);
  return u.toString();
}

export const pricesFrom = (art: ArtInfo) => basePrices.small + (art.markups.small || 0);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (v: number) => +v.toFixed(2);

// ---------------- shared pieces ----------------
/** The Artfinity name, y is the baseline. With the logo in the code the mark is already there, so only the
 *  wordmark is set; without it, the paint-swatch mark leads (not finder-shaped, so scanners ignore it). */
function brand(f: Fonts, x: number, y: number, size: number, ink: string, anchor: "start" | "middle" = "start", mark = true) {
  const b = mark ? size * 1.15 : 0, gap = mark ? size * 0.3 : 0, tw = width(f.display, "artfinity", size);
  const total = b + gap + tw;
  const x0 = anchor === "middle" ? x - total / 2 : x;
  let s = "<g>";
  if (mark) {
    // The mark's a sits on the baseline, as tall as the wordmark's x-height.
    const [bx, by, bw, bh] = MARK_BOX, k = b / bw;
    const top = y - capHeight(f.display) * size * 0.5 - (bh * k) / 2 - size * 0.04;
    s += `<g transform="translate(${n2(x0 - bx * k)} ${n2(top - by * k)}) scale(${n2(k)})">${markPaths(ink)}</g>`;
  }
  return s + text(f.display, "artfinity", x0 + b + gap, y, size, ink) + "</g>";
}

/**
 * The scan discount, drawn the same way on every format: a flat rounded badge, "10% OFF" then "when you scan".
 * (x, y) is its top-left corner, or its top-center with anchor "middle". Returns the svg and its width.
 */
function badge(f: Fonts, pct: number, fill: string, ink: string, x: number, y: number, h: number, maxW: number, anchor: "start" | "middle" = "start") {
  const big = `${pct}% OFF`, sub = "when you scan";
  let bs = h * 0.52, ss = h * 0.3;
  const pad = h * 0.42, gap = h * 0.26;
  let bw = width(f.display, big, bs), sw = width(f.semi, sub, ss);
  let w = pad + bw + gap + sw + pad;
  let withSub = true;
  if (w > maxW) {
    // Shrink a little, then drop the small words before anything gets too small to read.
    const k = Math.max(0.82, (maxW - 2 * pad - gap) / (bw + sw));
    bs *= k; ss *= k; bw *= k; sw *= k; w = pad + bw + gap + sw + pad;
    if (w > maxW) { withSub = false; w = pad + bw + pad; }
  }
  const x0 = anchor === "middle" ? x - w / 2 : x;
  const mid = y + h / 2;
  let s = `<rect x="${n2(x0)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(h * 0.24)}" fill="${fill}"/>`;
  s += text(f.display, big, x0 + pad, mid + (capHeight(f.display) * bs) / 2, bs, ink);
  if (withSub) s += text(f.semi, sub, x0 + pad + bw + gap, mid + (capHeight(f.semi) * ss) / 2, ss, ink);
  return { svg: s, w };
}

type Line = { t: string; font: "semi" | "body"; op: number };
/** The small print every format shares, in the same order: title, artist, venue, price. */
function smallPrint(art: ArtInfo, d: Design, ev: string, price: string): Line[] {
  const out: Line[] = [];
  if (d.showTitle) { out.push({ t: art.title, font: "semi", op: 1 }); out.push({ t: art.artist, font: "body", op: 0.72 }); }
  if (ev) out.push({ t: ev, font: "semi", op: 0.72 });
  if (price) out.push({ t: price, font: "body", op: 0.72 });
  return out;
}

export type Card = { inner: string; w: number; h: number; qrPt: number; ctaPt: number; label: string };

// ---------------- faces ----------------
// One rule for all four: the same margin on every side, measured to the ink (the code is drawn without its own white
// border, so its dots line up with the words). Landscape label: two columns whose tops and bottoms line up with the
// code. Sticker, hang tag and poster: everything on one centre line, with equal gaps between the parts.
export function renderCard(d: Design, art: ArtInfo, f: Fonts, qrText: string, uid = "c"): Card {
  const cta = ctaText(d);
  const ink = d.fg, tagInk = inkOn(d.tag);
  // Limited editions add a short line to the price text ("Prints from $40 · Edition of 25").
  const price = d.showPrice
    ? `Prints from ${money(pricesFrom(art))}${art.edition ? ` · Edition of ${art.edition}` : ""}`
    : art.edition ? `Limited edition of ${art.edition}` : "";
  const ev = d.evPrint ? d.ev.trim() : "";
  const label = `${FORMATS[d.format].name}: ${cta}.${d.disc ? ` ${d.disc}% off when you scan.` : ""} ${art.title} by ${art.artist}.`;
  const dcap = capHeight(f.display), bcap = capHeight(f.body);
  const lines = smallPrint(art, d, ev, price);
  const code = (x: number, y: number, size: number) =>
    qrSVG(qrText, { fg: d.fg, dots: d.dots, eyes: d.eyes, eyeColor: eyeColor(d), label: esc(`QR code for ${art.title}`), logo: d.logo, quiet: 0 })
      .replace("<svg ", `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" `);

  if (d.format === "label") {
    // 3.5 × 2 in. Code on the right, as tall as the card allows; words on the left, top and bottom flush with it.
    const W = 252, H = 144, m = 15, Q = H - 2 * m, qx = W - m - Q, gut = 14;
    const x0 = m, tw = qx - gut - m;
    let s = `<rect width="${W}" height="${H}" rx="6" fill="${d.bg}"/>` + code(qx, m, Q);
    // Bottom group, bottom up: the last baseline sits on the bottom margin.
    const fs = 7.2, lh = fs * 1.32, bsz = 8;
    let base = H - m;
    if (d.showBrand) { s += brand(f, x0, base, bsz, ink, "start", !d.logo); base -= dcap * bsz + fs * 0.85; }
    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i];
      s += text(f[L.font], fit(f[L.font], L.t, fs, tw), x0, base, fs, ink, "start", L.op);
      if (i) base -= lh;
    }
    const bottomTop = lines.length ? base - bcap * fs : d.showBrand ? base + fs * 0.85 : H - m;
    // Top group: the first ink sits on the top margin.
    let y = m;
    if (d.disc) { s += badge(f, d.disc, d.tag, tagInk, x0, y, 19, tw).svg; y += 19 + 9; }
    const blk = fitBlock(f.display, cta, { max: d.disc ? 25 : 30, min: 10, maxW: tw, maxH: bottomTop - 9 - y, lh: 0.92, maxLines: 3 });
    y += dcap * blk.size;
    for (const line of blk.lines) { s += text(f.display, line, x0, y, blk.size, ink); y += blk.size * 0.92; }
    return { inner: s, w: W, h: H, qrPt: Q, ctaPt: blk.size, label };
  }

  if (d.format === "sticker") {
    // 2 in circle, drawn on a 200 grid. Code dead centre; words over the top and a badge (or the title) under it,
    // each the same distance from the code.
    const S = 144, k = S / 200, C = 100, R = 99, Q = 76, half = Q / 2;
    let s = `<circle cx="${C}" cy="${C}" r="${R}" fill="${d.bg}" stroke="#000" stroke-opacity=".12" stroke-width="1"/>`;
    s += code(C - half, C - half, Q);
    // The words ride on a circle just clear of the code's corners; the badge or title under it sits the same
    // distance from the centre, so the gaps above and below match.
    const clear = half * Math.SQRT2 + 4;
    const up = cta.toUpperCase();
    const cs = Math.min(24, (24 * clear * 2.05) / arcWidth(f.display, up, 24, 0.6), (R - clear - 7) / dcap);
    s += arcText(f.display, up, C, C, clear, cs, ink, 1, 0.6);
    if (d.disc) {
      const bh = 22, top = C + clear - 4, chordHalf = Math.sqrt(R * R - (top + bh - C) ** 2);
      s += badge(f, d.disc, d.tag, tagInk, C, top, bh, chordHalf * 2 - 8, "middle").svg;
    } else if (d.showTitle) {
      const ts = Math.min(12, (R - clear - 7) / capHeight(f.semi));
      let line = `${art.title} · ${art.artist}`;
      if (arcWidth(f.semi, line, ts, 0.2) > clear * 2.3) line = art.title;
      s += arcText(f.semi, fit(f.semi, line, ts, clear * 2.3), C, C, clear + capHeight(f.semi) * ts, ts, ink, -1, 0.2, 0.85);
    } else if (d.showBrand) {
      s += brand(f, C, C + clear + dcap * 12, 12, ink, "middle", !d.logo);
    }
    return { inner: `<g transform="scale(${k})">${s}</g>`, w: S, h: S, qrPt: Q * k, ctaPt: cs * k, label };
  }

  if (d.format === "tag") {
    // 2 × 3.5 in, hole at the top. One centre line; the code as wide as the margins allow.
    const W = 144, H = 252, m = 14, cw = W - 2 * m, r = 7;
    const holeY = 17, holeR = 5;
    const SH = d.disc ? 50 : 0, stubY = H - SH;
    let s = `<defs><mask id="qs-m-${uid}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${W / 2}" cy="${holeY}" r="${holeR}" fill="#000"/>` +
      (d.disc ? `<circle cx="0" cy="${stubY}" r="6" fill="#000"/><circle cx="${W}" cy="${stubY}" r="6" fill="#000"/>` : "") + `</mask></defs>`;
    s += `<g mask="url(#qs-m-${uid})"><rect width="${W}" height="${H}" rx="${r}" fill="${d.bg}"/>`;
    if (d.disc) s += `<path d="M0 ${stubY}H${W}V${H - r}a${r} ${r} 0 0 1 -${r} ${r}H${r}a${r} ${r} 0 0 1 -${r} -${r}Z" fill="${d.tag}"/>` +
      `<line x1="8" x2="${W - 8}" y1="${stubY}" y2="${stubY}" stroke="${d.bg}" stroke-width="1.3" stroke-dasharray="3 2"/>`;
    s += `</g><circle cx="${W / 2}" cy="${holeY}" r="${holeR}" fill="none" stroke="#000" stroke-opacity=".2" stroke-width="1"/>`;

    // The stack: [brand] · words · code · small print, centred in the space between the hole and the bottom.
    const top = holeY + holeR + 10, bottom = (d.disc ? stubY : H) - m;
    const fs = 7.4, lh = fs * 1.32, bsz = 8, gap = 10;
    const brandH = d.showBrand ? dcap * bsz : 0;
    const textH = lines.length ? bcap * fs + (lines.length - 1) * lh : 0;
    const parts = (d.showBrand ? 1 : 0) + 2 + (lines.length ? 1 : 0);
    let Q = cw;
    const fixed = brandH + textH + gap * (parts - 1);
    let blk = fitBlock(f.display, cta, { max: 22, min: 11, maxW: cw, maxH: 44, lh: 0.92, maxLines: 2 });
    let ch = blockH(f.display, blk.lines.length, blk.size, 0.92);
    Q = Math.min(cw, bottom - top - fixed - ch);
    if (Q < 70) { blk = fitBlock(f.display, cta, { max: 15, min: 10, maxW: cw, maxH: 30, lh: 0.92, maxLines: 2 }); ch = blockH(f.display, blk.lines.length, blk.size, 0.92); Q = Math.min(cw, bottom - top - fixed - ch); }
    const used = fixed + ch + Q;
    let y = top + (bottom - top - used) / 2;
    if (d.showBrand) { y += brandH; s += brand(f, W / 2, y, bsz, ink, "middle", !d.logo); y += gap; }
    y += dcap * blk.size;
    blk.lines.forEach((line, i) => { s += text(f.display, line, W / 2, y, blk.size, ink, "middle"); if (i < blk.lines.length - 1) y += blk.size * 0.92; });
    y += gap;
    s += code((W - Q) / 2, y, Q);
    y += Q + gap;
    lines.forEach((L, i) => { y += i ? lh : bcap * fs; s += text(f[L.font], fit(f[L.font], L.t, fs, cw), W / 2, y, fs, ink, "middle", L.op); });
    if (d.disc) {
      // The stub: "10% OFF" and "when you scan", centred, same margins as above.
      const ns = 26, num = `${d.disc}% OFF`, ss = 7.4;
      const nh = dcap * ns, sh = bcap * ss, g2 = 6;
      const yy = stubY + (SH - (nh + g2 + sh)) / 2;
      s += text(f.display, fit(f.display, num, ns, cw), W / 2, yy + nh, ns, tagInk, "middle");
      s += text(f.semi, "when you scan this code", W / 2, yy + nh + g2 + sh, ss, tagInk, "middle");
    }
    return { inner: s, w: W, h: H, qrPt: Q, ctaPt: blk.size, label };
  }

  // poster, 8.5 × 11 in: one centre line, ¾ in margins. Words · [badge] · code · small print, then the name at the foot.
  const W = 612, H = 792, m = 54, cw = W - 2 * m;
  let s = `<rect width="${W}" height="${H}" fill="${d.bg}"/>`;
  const fs = 21, lh = fs * 1.32, bsz = 24, gap = 30, bh = 64;
  const brandH = d.showBrand ? dcap * bsz : 0;
  const textH = lines.length ? bcap * fs + (lines.length - 1) * lh : 0;
  const blk = fitBlock(f.display, cta, { max: 96, min: 48, maxW: cw, maxH: 190, lh: 0.92, maxLines: 2 });
  const ch = blockH(f.display, blk.lines.length, blk.size, 0.92);
  const parts = 2 + (d.disc ? 1 : 0) + (lines.length ? 1 : 0) + (d.showBrand ? 1 : 0);
  const fixed = ch + (d.disc ? bh : 0) + textH + brandH + gap * (parts - 1);
  const Q = Math.min(cw * 0.78, H - 2 * m - fixed);
  let y = m + (H - 2 * m - fixed - Q) / 2;
  y += dcap * blk.size;
  blk.lines.forEach((line, i) => { s += text(f.display, line, W / 2, y, blk.size, ink, "middle"); if (i < blk.lines.length - 1) y += blk.size * 0.92; });
  y += gap;
  if (d.disc) { s += badge(f, d.disc, d.tag, tagInk, W / 2, y, bh, cw, "middle").svg; y += bh + gap; }
  s += code((W - Q) / 2, y, Q);
  y += Q + gap;
  lines.forEach((L, i) => { y += i ? lh : bcap * fs; s += text(f[L.font], fit(f[L.font], L.t, fs, cw), W / 2, y, fs, ink, "middle", L.op); });
  if (d.showBrand) s += brand(f, W / 2, H - m, bsz, ink, "middle", !d.logo);
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

/**
 * One sheet of DIFFERENT cards in the same format (the print queue): `cards` fill the slots in order, empty slots stay
 * blank. Callers split a longer list into pages of sheetLayout(fmt).slots.length. Same layout and marks as sheetSVG.
 */
export function mixedSheetSVG(cards: Card[], fmt: FormatKey, uid = "m") {
  const L = sheetLayout(fmt);
  const ids = new Map<Card, string>();
  let defs = "";
  for (const c of cards) if (!ids.has(c)) { const id = `qs-mix-${uid}-${ids.size}`; ids.set(c, id); defs += `<symbol id="${id}" viewBox="0 0 ${c.w} ${c.h}">${c.inner}</symbol>`; }
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="8.5in" height="11in" role="img" aria-label="Print sheet: ${cards.length} of ${L.slots.length} ${esc(FORMATS[fmt].name.toLowerCase())} spots filled">` +
    `<rect width="${L.W}" height="${L.H}" fill="#fff"/><defs>${defs}</defs>`;
  L.slots.forEach((p, i) => {
    const c = cards[i];
    if (c) s += `<use href="#${ids.get(c)}" x="${n2(p.x)}" y="${n2(p.y)}" width="${c.w}" height="${c.h}"/>`;
    else s += `<rect x="${n2(p.x + 3)}" y="${n2(p.y + 3)}" width="${n2(L.cw - 6)}" height="${n2(L.ch - 6)}" rx="${fmt === "sticker" ? n2(L.cw / 2) : 6}" fill="none" stroke="#c9ccd3" stroke-dasharray="4 3"/>`;
  });
  if (L.marks.length) s += `<path stroke="#15161b" stroke-width=".5" fill="none" d="${L.marks.map((m) => `M${m[0]} ${m[1]}L${m[2]} ${m[3]}`).join("")}"/>`;
  return s + "</svg>";
}

// ---------------- scan maths ----------------
export function scanNumbers(c: Card, qrText: string, f: Fonts, logo = false) {
  const n = qrMatrix(qrText, logo ? "H" : "M").length;
  // qrPt is the code's own size (drawn without a white border; the card's margin is the quiet zone).
  const qrIn = c.qrPt / 72, modIn = qrIn / n, codeIn = qrIn;
  const capIn = (c.ctaPt * capHeight(f.display)) / 72;
  return { n, modMm: modIn * 25.4, codeIn, scanCm: codeIn * 2.54 * 10, readM: capIn * 3.05 };
}
export function fmtDist(cm: number) {
  return cm >= 100 ? (cm / 100).toFixed(1).replace(/\.0$/, "") + " m" : Math.round(cm / 5) * 5 + " cm";
}
