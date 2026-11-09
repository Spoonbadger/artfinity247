// QR Studio card faces, drawn as one SVG each (text outlined), in points (72 per inch).
// The same function feeds the live preview, the SVG download and the print PDF.
//
// The rules every face follows (approved Nov 2026):
// - The painting's title is the headline, in the display face. That is the only display text on a card. Everything
//   else is one body size, regular weight, with the price in semibold.
// - The code is as big as the format allows. The "a" mark in its middle is the only logo (no wordmark).
// - One solid dark shape (the pill or the panel) balances the title.
// - The code is drawn with no white border of its own: the card margin (or the plate under it) is the quiet zone,
//   and it is always at least 2 modules. One margin on every side, measured to the ink.
import { qrSVG, qrMatrix, type DotStyle, type EyeStyle } from "@/lib/qr/render";
import { MARK_BOX, MARK_SWATCH } from "@/lib/brand/mark";
import { basePrices } from "@/lib/artwork_price";
import { breakdown, money, type SizeKey } from "@/lib/earnings";
import { shortUrl } from "@/lib/shortcode";
import { artPath } from "@/lib/urls";
import { type Fonts, text, fit, fitBlock, capHeight, width, ink } from "./text";

// ---------------- options ----------------
export type FormatKey = "label" | "sticker" | "tag" | "poster";
export type StyleKey = "pill" | "panel" | "clean" | "brush";
export type InkKey = "black" | "color";
export type PresetKey = "gallery" | "sticker" | "market" | "poster";
/** Infinity extras. Each one is shown as a look of its own; on Infinity they can be combined. */
export type ExtraKey = "match" | "thumb" | "painted" | "tape" | "event" | "initials";
/** Seasonal looks (Infinity): flat motifs in the free space around the content, plus a season colour in Color ink. */
export type SeasonKey = "winter" | "newyear" | "valentine" | "spring" | "summer" | "fall";
export type EndKey = "never" | "event" | "30";

type Sheet = { cols: number; rows: number; gx: number; gy: number; note: string };
export const FORMATS: Record<FormatKey, { name: string; w: number; h: number; sheet: Sheet }> = {
  label: { name: "Wall label", w: 3.5, h: 2, sheet: { cols: 2, rows: 5, gx: 0, gy: 0, note: "10 per sheet. Standard business-card layout." } },
  sticker: { name: "Round sticker", w: 2, h: 2, sheet: { cols: 3, rows: 4, gx: 0.5, gy: 0.5, note: "12 per sheet. Fits 2 in round labels." } },
  tag: { name: "Hang tag", w: 2, h: 3.5, sheet: { cols: 4, rows: 3, gx: 0, gy: 0, note: "12 per sheet. Punch the hole after cutting." } },
  poster: { name: "Poster", w: 8.5, h: 11, sheet: { cols: 1, rows: 1, gx: 0, gy: 0, note: "One per sheet. Print at 11 × 17 in to scan from twice as far." } },
};
const ALL: FormatKey[] = ["label", "sticker", "tag", "poster"];
export const STYLES: Record<StyleKey, { name: string; formats: FormatKey[] }> = {
  pill: { name: "Pill", formats: ALL },
  panel: { name: "Panel", formats: ALL },
  clean: { name: "Clean", formats: ["label"] },
  brush: { name: "Brush", formats: ["label"] },
};
type Inks = { fg: string; bg: string; eye: string; accent: string; tag: string };
export const INKS: Record<InkKey, Inks & { name: string }> = {
  // Pure black on white: prints clean on an office laser printer. The brush is the one tint (black at 16%).
  black: { name: "Black ink", fg: "#000000", bg: "#ffffff", eye: "same", accent: "#000000", tag: "#000000" },
  color: { name: "Color", fg: "#15161b", bg: "#ffffff", eye: "#2b37f0", accent: "#2b37f0", tag: "#ffd43b" },
};
export const EXTRAS: Record<ExtraKey, { name: string; sub: string; formats: FormatKey[] }> = {
  match: { name: "Match your art", sub: "Color from the painting", formats: ALL },
  thumb: { name: "With thumbnail", sub: "A small copy of the piece", formats: ["label", "tag", "poster"] },
  painted: { name: "Painted panel", sub: "A brushed edge", formats: ["label", "tag", "poster"] },
  tape: { name: "Tape corners", sub: "Taped to the wall", formats: ["label", "tag", "poster"] },
  event: { name: "Event edition", sub: "Show name, date and a deal", formats: ALL },
  initials: { name: "Your initials", sub: "In the middle of the code", formats: ALL },
};
export const SEASONS: Record<SeasonKey, { name: string; sub: string; accent: string; motif: string[]; shape: "flake" | "confetti" | "heart" | "bloom" | "sun" | "leaf" }> = {
  winter: { name: "Winter holidays", sub: "Evergreen and snowflakes", accent: "#14633f", motif: ["#7fb6d9"], shape: "flake" },
  newyear: { name: "New Year", sub: "Confetti", accent: "#15161b", motif: ["#ffd43b", "#ff5a36", "#2b37f0"], shape: "confetti" },
  valentine: { name: "Valentine's", sub: "Hearts", accent: "#c8234a", motif: ["#ff8fa8", "#c8234a"], shape: "heart" },
  spring: { name: "Spring", sub: "Blooms", accent: "#2f7d4f", motif: ["#ff9ec4", "#ffd43b"], shape: "bloom" },
  summer: { name: "Summer market", sub: "Sunshine", accent: "#ff5a36", motif: ["#ffc21a"], shape: "sun" },
  fall: { name: "Fall", sub: "Leaves for Halloween", accent: "#a4431c", motif: ["#e0892b", "#c0392b", "#d9a521"], shape: "leaf" },
};
/** The season for a date, so the editor can show this season's look first. */
export function seasonFor(at = new Date()): SeasonKey {
  const md = (at.getMonth() + 1) * 100 + at.getDate();
  if (md >= 1227 || md <= 110) return "newyear";
  if (md >= 125 && md <= 214) return "valentine";
  if (md >= 301 && md <= 531) return "spring";
  if (md >= 601 && md <= 831) return "summer";
  if (md >= 901 && md <= 1115) return "fall";
  return "winter";
}
export const DOTS: Record<DotStyle, string> = { square: "Square", rounded: "Soft", dots: "Dots", liquid: "Liquid", lines: "Lines", diamond: "Diamond" };
export const EYES: Record<EyeStyle, string> = { frame: "Frame mark", square: "Square", rounded: "Rounded", circle: "Circle" };
export const FG = ["#000000", "#15161b", "#2b37f0", "#0f7a55", "#7b2d8e", "#b8321c"];
export const BG = ["#ffffff", "#f2f3ec", "#ffd43b", "#ffd6cc", "#d4e6ff", "#15161b"];
export const ACCENT = ["#000000", "#2b37f0", "#ff5a36", "#0f7a55", "#7b2d8e", "#ffd43b"];
export const TAG = ["#000000", "#ffd43b", "#ff5a36", "#2b37f0", "#0f7a55", "#ffd6cc"];
export const EYE = ["same", "#2b37f0", "#ff5a36", "#0f7a55"];
export const COLOR_NAMES: Record<string, string> = {
  "#000000": "Black", "#15161b": "Ink", "#2b37f0": "Scan blue", "#0f7a55": "Green", "#7b2d8e": "Plum", "#b8321c": "Brick", "#ffffff": "White",
  "#f2f3ec": "Wall white", "#ffd43b": "Sticker yellow", "#ffd6cc": "Blush", "#d4e6ff": "Sky", "#ff5a36": "Coral", same: "Same as code",
};
export const DISCOUNTS = [0, 10, 15, 20, 25];
/** Longest custom message: it has to fit the label's pill on two lines. */
export const MSG_MAX = 20;

type Look = { format: FormatKey; style: StyleKey; ink: InkKey; dots: DotStyle; eyes: EyeStyle } & Inks;
export const PRESETS: Record<PresetKey, Look & { name: string; sub: string }> = {
  gallery: { name: "Gallery label", sub: "Beside the painting", format: "label", style: "pill", ink: "black", dots: "rounded", eyes: "rounded", ...pickInks("black") },
  sticker: { name: "Sticker", sub: "Round and loud", format: "sticker", style: "pill", ink: "color", dots: "dots", eyes: "circle", fg: "#15161b", bg: "#ffd43b", eye: "same", accent: "#15161b", tag: "#15161b" },
  market: { name: "Market tag", sub: "Hangs off a frame", format: "tag", style: "pill", ink: "color", dots: "square", eyes: "rounded", fg: "#15161b", bg: "#ffffff", eye: "#ff5a36", accent: "#ff5a36", tag: "#ffd43b" },
  poster: { name: "Show poster", sub: "Door or easel", format: "poster", style: "panel", ink: "color", dots: "liquid", eyes: "frame", fg: "#2b37f0", bg: "#f2f3ec", eye: "same", accent: "#2b37f0", tag: "#ffd43b" },
};
function pickInks(k: InkKey): Inks { const { fg, bg, eye, accent, tag } = INKS[k]; return { fg, bg, eye, accent, tag }; }

export type Design = Look & {
  preset: PresetKey | "custom";
  /** Your own words for the pill or panel message ("" = the standard wording). */
  msg: string;
  showTitle: boolean;
  showPrice: boolean;
  /** Artfinity mark in the middle of the code (switches the code to error correction H). */
  logo: boolean;
  disc: number;
  coupon: string;
  ev: string;
  evPrint: boolean;
  /** Last day of the event, YYYY-MM-DD, for the Event edition line ("" = none). */
  evDate: string;
  size: SizeKey;
  end: EndKey;
  extras: ExtraKey[];
  /** Up to 3 colours pulled from the painting (Match your art), and the piece they came from. */
  palette: string[];
  paletteOf: string;
  /** A seasonal look (Infinity), "" = none. */
  season: SeasonKey | "";
};

export function presetLook(k: PresetKey): Look {
  const { name, sub, ...look } = PRESETS[k];
  return look;
}

export const DEFAULT_DESIGN: Design = {
  preset: "gallery", ...presetLook("gallery"),
  msg: "", showTitle: true, showPrice: true, logo: true,
  disc: 0, coupon: "", ev: "", evPrint: false, evDate: "", size: "medium", end: "never",
  extras: [], palette: [], paletteOf: "", season: "",
};

/** `thumb`: a data: URI (or URL) of a small copy of the painting, for the thumbnail extra. Falls back to imageUrl. */
export type ArtInfo = { slug: string; title: string; artist: string; imageUrl: string; markups: Record<SizeKey, number>; sensitive?: string[]; edition?: number | null; thumb?: string };

// ---------------- helpers ----------------
const HEX = /^#[0-9a-f]{6}$/i;
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").slice(0, max) : d);
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const color = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : d);
const EXTRA_KEYS = Object.keys(EXTRAS) as ExtraKey[];

/**
 * Anything from a client becomes a valid Design. Designs saved before the Nov 2026 styles (no `style`) still render:
 * they become the Pill style, the dark shape takes the old corner colour (or the code colour), the old price-tag
 * colour becomes the brush colour, and a custom headline becomes the pill message.
 */
export function sanitizeDesign(input: unknown): Design {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const D = DEFAULT_DESIGN;
  const legacy = !("style" in i) && !("ink" in i) && ("fg" in i || "cta" in i || "format" in i);
  const fg = color(i.fg, legacy ? "#15161b" : D.fg), bg = color(i.bg, D.bg);
  const eye = i.eye === "same" ? "same" : color(i.eye, legacy ? "same" : D.eye);
  const ink: InkKey = legacy ? (lum(fg) < 0.02 && bg === "#ffffff" && eye === "same" ? "black" : "color") : oneOf(i.ink, ["black", "color"] as const, D.ink);
  const extras = Array.isArray(i.extras) ? EXTRA_KEYS.filter((k) => (i.extras as unknown[]).includes(k)) : [];
  return {
    preset: oneOf(i.preset, ["gallery", "sticker", "market", "poster", "custom"] as const, "custom"),
    format: oneOf(i.format, ALL, D.format),
    style: legacy ? "pill" : oneOf(i.style, Object.keys(STYLES) as StyleKey[], D.style),
    ink,
    msg: legacy ? (i.cta === "custom" ? str(i.ctaCustom, MSG_MAX).trim() : "") : str(i.msg, MSG_MAX),
    showTitle: bool(i.showTitle, D.showTitle),
    showPrice: bool(i.showPrice, D.showPrice),
    logo: bool(i.logo, D.logo),
    disc: DISCOUNTS.includes(Number(i.disc)) ? Number(i.disc) : 0,
    coupon: str(i.coupon, 16),
    dots: oneOf(i.dots, Object.keys(DOTS) as DotStyle[], D.dots),
    eyes: oneOf(i.eyes, Object.keys(EYES) as EyeStyle[], D.eyes),
    fg, bg, eye,
    accent: color(i.accent, legacy ? (eye !== "same" ? eye : fg) : INKS[ink].accent),
    tag: color(i.tag, INKS[ink].tag),
    ev: str(i.ev, 32),
    evPrint: bool(i.evPrint, false),
    evDate: typeof i.evDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.evDate) ? i.evDate : "",
    size: oneOf(i.size, ["small", "medium", "large", "xl"] as const, D.size),
    end: oneOf(i.end, ["never", "event", "30"] as const, D.end),
    extras,
    palette: Array.isArray(i.palette) ? i.palette.filter((c): c is string => typeof c === "string" && HEX.test(c)).slice(0, 3).map((c) => c.toLowerCase()) : [],
    paletteOf: str(i.paletteOf, 120),
    season: oneOf(i.season, ["", ...(Object.keys(SEASONS) as SeasonKey[])] as const, ""),
  };
}

/** The Ink switch: resets the five colours to that ink. Black ink also drops Match your art (it adds colour). */
export function applyInk(d: Design, ink: InkKey): Design {
  return { ...d, ink, ...pickInks(ink), extras: ink === "black" ? d.extras.filter((e) => e !== "match") : d.extras };
}
/** Do the colours still match the ink they were set from? */
export function inkMatches(d: Design) {
  const k = INKS[d.ink];
  return d.fg === k.fg && d.bg === k.bg && d.eye === k.eye && d.accent === k.accent && d.tag === k.tag;
}
/** The style this format really draws: Clean and Brush are wall-label styles, elsewhere they draw as Pill. */
export const styleOf = (d: Pick<Design, "style" | "format">): StyleKey => (STYLES[d.style].formats.includes(d.format) ? d.style : "pill");
export const stylesFor = (f: FormatKey) => (Object.keys(STYLES) as StyleKey[]).filter((k) => STYLES[k].formats.includes(f));

/** Turn an Infinity extra on or off. Turning one on moves to a format and style that can show it. */
export function applyExtra(d: Design, k: ExtraKey, on = true): Design {
  const extras = on ? EXTRA_KEYS.filter((e) => e === k || d.extras.includes(e)) : d.extras.filter((e) => e !== k);
  const next: Design = { ...d, extras };
  if (!on) return next;
  if (!EXTRAS[k].formats.includes(d.format)) next.format = "label";
  if (k === "painted") next.style = "panel";
  if (k === "match" && d.ink === "black") next.ink = "color";
  if (k === "event") { next.evPrint = true; if (!d.disc) next.disc = 10; }
  return next;
}
/** Infinity extras this design uses. */
export const extrasOf = (d: Pick<Design, "extras">) => d.extras;
/** The closest free design: the same format, style, ink and colours without the Infinity extras. */
export const freeDesign = (d: Design): Design => (d.extras.length || d.season ? { ...d, extras: [], season: "" } : d);
/** Does this design use anything from Infinity? */
export const usesInfinity = (d: Pick<Design, "extras" | "season">) => d.extras.length > 0 || !!d.season;

/** A seasonal look on the current format and style. In Color ink the pill or panel takes the season's colour. */
export function applySeason(d: Design, k: SeasonKey | ""): Design {
  if (!k) return { ...d, season: "" };
  const S = SEASONS[k];
  // The code corners take the season's colour too, darkened until phones read it easily (4.5:1 on the card).
  let eye = S.accent === "#15161b" ? "#2b37f0" : S.accent;
  for (let i = 0; i < 40 && contrast(eye, d.bg) < 4.5; i++) eye = mix(eye, "#000000", 0.06);
  return { ...d, season: k, ...(d.ink === "color" ? { accent: S.accent, eye } : {}), extras: d.extras.filter((e) => e !== "match") };
}

export function lum(hex: string) {
  const h = hex.replace("#", "");
  return [0, 2, 4]
    .map((i) => { const v = parseInt(h.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
export const inkOn = (bg: string) => (lum(bg) > 0.36 ? "#15161b" : "#ffffff");
export const eyeColor = (d: Design) => cardColors(d).eye;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16));
const hex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
export const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
const chroma = (c: string) => { const v = rgb(c); return Math.max(...v) - Math.min(...v); };

/**
 * Match your art: the palette colour to use for the pill or panel and the code corners. Each colour is darkened until
 * white text on it reaches 4.5:1; the most colourful result wins (the painting's most common colour breaks ties).
 */
export function matchAccent(palette: string[]): string | null {
  let best: string | null = null, score = -1;
  palette.forEach((c, i) => {
    let x = c;
    for (let k = 0; k < 60 && contrast("#ffffff", x) < 4.5; k++) x = mix(x, "#000000", 0.06);
    if (contrast("#ffffff", x) < 4.5) return;
    const s = chroma(x) * (1 - 0.12 * i) + 1;
    if (s > score) { score = s; best = x; }
  });
  return best;
}

const onColor = (bg: string, dark: string) => (contrast("#ffffff", bg) >= contrast(dark, bg) ? "#ffffff" : dark);
/** The colours a design draws with, after Match your art. */
export function cardColors(d: Design) {
  const matched = d.extras.includes("match") ? matchAccent(d.palette) : null;
  const accent = matched || d.accent;
  const eye = matched || (d.eye === "same" ? null : d.eye);
  const dark = lum(d.fg) < 0.02 ? d.fg : "#15161b";
  const text = contrast(d.fg, d.bg) >= 4.5 ? d.fg : onColor(d.bg, dark);
  const blackish = lum(d.tag) < 0.02;
  return {
    fg: d.fg, bg: d.bg, eye, accent, text, dark,
    onAccent: onColor(accent, dark),
    price: contrast(accent, d.bg) >= 4.5 ? accent : text,
    brush: d.tag, brushOp: blackish ? 0.16 : 1,
    // Flat, print-safe masking tape: the brush colour mixed toward white (black ink gives the same 16% tint, opaque).
    tape: mix(d.tag, "#ffffff", blackish ? 0.84 : 0.45),
  };
}
export type CardColors = ReturnType<typeof cardColors>;

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
/** The from-price a buyer really pays after a scan discount, in cents (same rounding as checkout). */
export const fromPrice = (art: ArtInfo, disc = 0) => breakdown("small", art.markups.small || 0, disc).price;
/** "$55", or "$34.99" when it isn't whole dollars. */
export const dollars = (cents: number) => (cents % 100 === 0 ? `$${cents / 100}` : money(cents));

/**
 * Exactly what a printed card shows, for records of what was printed (price checks after a price change).
 * priceShownCents is null when the card shows no price.
 */
export function printedFacts(design: Design, art: Pick<ArtInfo, "title" | "markups">) {
  return {
    priceShownCents: design.showPrice ? breakdown("small", art.markups.small || 0, design.disc).price : null,
    discountPct: design.disc || null,
    format: design.format,
    style: styleOf(design),
    ink: design.ink,
    title: design.showTitle ? art.title : null,
  };
}

/** "DK" from "Dyann Klein": first and last word. One word: its first letter. null if there are no letters. */
export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, "")).filter(Boolean);
  if (!words.length) return null;
  const a = words[0][0], b = words.length > 1 ? words[words.length - 1][0] : "";
  return (a + b).toUpperCase();
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n2 = (v: number) => +v.toFixed(2);

// ---------------- message ----------------
type Seg = { t: string; b?: boolean };
type RLine = Seg[];
/**
 * The pill or panel message. "pill": one line ("Prints from $55"). "two": the panel and clean styles' two lines
 * ("Scan for prints" / "from $55"). "wide": the poster's one line ("Scan for prints from $55").
 */
export function messageLines(d: Design, art: ArtInfo, kind: "pill" | "two" | "wide"): RLine[] {
  const price = d.showPrice ? dollars(fromPrice(art, d.disc)) : "";
  const msg = d.msg.trim();
  if (msg) {
    if (kind === "two") return price ? [[{ t: msg }], [{ t: "from " }, { t: price, b: true }]] : [[{ t: msg }]];
    return [price ? [{ t: `${msg} · ` }, { t: price, b: true }] : [{ t: msg }]];
  }
  if (d.disc) {
    if (kind === "two") return price ? [[{ t: `Scan for ${d.disc}% off` }], [{ t: "prints from " }, { t: price, b: true }]] : [[{ t: `Scan for ${d.disc}% off` }]];
    return [price ? [{ t: `${d.disc}% off · prints from ` }, { t: price, b: true }] : [{ t: `Scan for ${d.disc}% off` }]];
  }
  if (kind === "two") return price ? [[{ t: "Scan for prints" }], [{ t: "from " }, { t: price, b: true }]] : [[{ t: "Scan for prints" }]];
  if (kind === "wide") return [price ? [{ t: "Scan for prints from " }, { t: price, b: true }] : [{ t: "Scan for prints" }]];
  return [price ? [{ t: "Prints from " }, { t: price, b: true }] : [{ t: "Scan for prints" }]];
}
const plain = (l: RLine) => l.map((s) => s.t).join("");

function segW(f: Fonts, l: RLine, size: number) { return l.reduce((a, s) => a + width(s.b ? f.semi : f.body, s.t, size), 0); }
function drawLine(f: Fonts, l: RLine, x: number, y: number, size: number, fill: string, bFill: string, anchor: "start" | "middle" = "start") {
  const w = segW(f, l, size);
  let x0 = anchor === "middle" ? x - w / 2 : x, out = "";
  for (const s of l) { const F = s.b ? f.semi : f.body; out += text(F, s.t, x0, y, size, s.b ? bFill : fill); x0 += width(F, s.t, size); }
  return out;
}
/** Ink box of a message line (left bearing of its first part, highest top, lowest bottom). */
function lineInk(f: Fonts, l: RLine, size: number) {
  let y1 = 0, y2 = 0, x1 = 0, x = 0;
  l.forEach((sg, i) => { const F = sg.b ? f.semi : f.body, b = ink(F, sg.t, size); if (i === 0) x1 = b.x1; y1 = Math.min(y1, b.y1); y2 = Math.max(y2, b.y2); x += width(F, sg.t, size); });
  return { x1, y1, y2, w: x };
}
/** Shorten a line that can't fit: drop the price weight and end in an ellipsis. */
function clampLine(f: Fonts, l: RLine, size: number, maxW: number): RLine {
  return segW(f, l, size) <= maxW ? l : [{ t: fit(f.body, plain(l), size, maxW) }];
}
/** One message line in at most `max` lines, broken where it balances best (a "·" break drops the dot). */
function wrapLine(f: Fonts, l: RLine, size: number, maxW: number, max: number): RLine[] {
  if (segW(f, l, size) <= maxW || max < 2) return [clampLine(f, l, size, maxW)];
  const toks: Seg[] = [];
  for (const s of l) for (const w of s.t.split(" ")) if (w) toks.push({ t: w, b: s.b });
  const join = (ts: Seg[]): RLine => {
    const out: RLine = [];
    ts.forEach((t, i) => {
      const word = (i ? " " : "") + t.t, last = out[out.length - 1];
      if (last && !!last.b === !!t.b) last.t += word; else out.push({ t: word, b: t.b });
    });
    return out;
  };
  let best: RLine[] | null = null, bw = Infinity;
  for (let k = 1; k < toks.length; k++) {
    const a = toks.slice(0, k), b = toks.slice(k);
    const dot = a[a.length - 1].t === "·";
    if (dot) a.pop();
    if (b[0]?.t === "·") b.shift();
    if (!a.length || !b.length) continue;
    const la = join(a), lb = join(b);
    const w = Math.max(segW(f, la, size), segW(f, lb, size)) - (dot ? maxW * 0.08 : 0);
    if (w < bw) { bw = w; best = [la, lb]; }
  }
  return (best || [l]).map((x) => clampLine(f, x, size, maxW));
}

// ---------------- shared drawing ----------------
type Box = { k: string; x: number; y: number; w: number; h: number; pts?: [number, number][] };
type Ctx = { d: Design; art: ArtInfo; f: Fonts; qrText: string; uid: string; n: number; C: CardColors; style: StyleKey; fx: Set<ExtraKey>; boxes: Box[]; defs: string[] };

/** Body text's ink box for the checks: cap height up, descenders down. */
const bodyBox = (x: number, y: number, w: number, size: number, f: Fonts): Box => ({ k: "text", x, y: y - capHeight(f.body) * size * 1.06, w, h: capHeight(f.body) * size * 1.06 + size * 0.24 });

function codeSvg(c: Ctx, x: number, y: number, size: number) {
  const { d, C, f } = c;
  const ini = c.fx.has("initials") ? initialsLogo(f, c.art.artist, C.eye || C.fg, C.bg) : null;
  c.boxes.push({ k: "code", x, y, w: size, h: size });
  return qrSVG(c.qrText, { fg: C.fg, dots: d.dots, eyes: d.eyes, eyeColor: C.eye, label: esc(`QR code for ${c.art.title}`), logo: ini ? { svg: ini } : d.logo, quiet: 0 })
    .replace("<svg ", `<svg x="${n2(x)}" y="${n2(y)}" width="${n2(size)}" height="${n2(size)}" `);
}
/** Your initials in the code: the mark's paint swatch with the letters knocked out, on the mark's 48 grid. */
function initialsLogo(f: Fonts, artist: string, paint: string, letter: string): string | null {
  const ini = initialsOf(artist);
  if (!ini || Array.from(ini).some((ch) => f.display.charToGlyph(ch).index === 0)) return null;
  const [bx, by, bw, bh] = MARK_BOX, k = 48 / bw, ty = (48 - bh * k) / 2 - by * k;
  const cap = capHeight(f.display), size = Math.min(29 / width(f.display, ini, 1), 19 / cap);
  return `<g transform="translate(${n2(-bx * k)} ${n2(ty)}) scale(${n2(k)})"><path fill="${paint}" d="${MARK_SWATCH}"/></g>` +
    text(f.display, ini, 24.6, 24 + (cap * size) / 2, size, letter, "middle");
}
/** Modules across the code this design draws (initials and the mark both use error correction H). */
export function codeModules(d: Design, qrText: string) {
  return qrMatrix(qrText, d.logo || d.extras.includes("initials") ? "H" : "M").length;
}

function thumbSvg(c: Ctx, x: number, y: number, w: number, h: number) {
  const href = c.art.thumb || c.art.imageUrl;
  if (!href) return "";
  const id = `qs-th-${c.uid}`;
  c.defs.push(`<clipPath id="${id}"><rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(Math.min(w, h) * 0.06)}"/></clipPath>`);
  c.boxes.push({ k: "thumb", x, y, w, h });
  return `<image href="${esc(href)}" x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="${n2(h)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>`;
}

/** The brush stroke under the price (Brush style). (x, y) = start of the text on its baseline. */
function brushUnder(c: Ctx, x: number, y: number, w: number, size: number) {
  const bx = x - size * 0.26, bw = w + size * 0.6, by = y - size * 0.47, bh = size * 0.87;
  c.boxes.push({ k: "brush", x: bx, y: by + bh * 0.2, w: bw, h: bh * 0.65 });
  return `<path transform="translate(${n2(bx)} ${n2(by)}) scale(${n2(bw / 200)} ${n2(bh / 40)})" fill="${c.C.brush}"${c.C.brushOp < 1 ? ` fill-opacity="${c.C.brushOp}"` : ""} d="M4 22C40 8 90 12 130 10S190 14 196 20C170 30 120 34 70 33S14 34 4 22Z"/>`;
}
/** Ink bottom of the brush stroke, below the baseline. */
const BRUSH_DROP = 0.27;

/**
 * A hand-painted edge for the Painted panel, drawn along x = 0..len and reaching up to `depth` past the panel's
 * straight edge (local +y, away from the panel): a slow wobble like one pass of a wide brush, with a few dry-bristle
 * streaks running alongside it, as in the brand stroke. Flat fill, print safe.
 */
function paintedEdge(len: number, depth: number, fill: string, transform: string) {
  const N = Math.max(40, Math.round(len / 2)), T = Math.PI * 2;
  const yAt = (t: number) => depth * (0.42 + 0.2 * Math.sin(T * 1.6 * t + 0.9) + 0.12 * Math.sin(T * 4.3 * t + 2.1) + 0.05 * Math.sin(T * 9.7 * t + 0.4));
  let d = `M0 ${n2(-depth)}`;
  for (let i = 0; i <= N; i++) d += `L${n2((len * i) / N)} ${n2(yAt(i / N))}`;
  d += `L${n2(len)} ${n2(-depth)}Z`;
  // Streaks: thin tapered slivers just outside the edge, following it.
  for (const [t0, t1, off, th] of [[0.06, 0.31, 0.3, 0.13], [0.44, 0.62, 0.36, 0.1], [0.7, 0.97, 0.28, 0.12]]) {
    const M = 16, top: string[] = [], bot: string[] = [];
    for (let i = 0; i <= M; i++) {
      const t = t0 + ((t1 - t0) * i) / M, taper = Math.sin((Math.PI * i) / M), y = yAt(t) + depth * off;
      top.push(`${n2(len * t)} ${n2(y - depth * th * taper)}`);
      bot.unshift(`${n2(len * t)} ${n2(y + depth * th * taper)}`);
    }
    d += `M${top.join("L")}L${bot.join("L")}Z`;
  }
  return `<path transform="${transform}" fill="${fill}" d="${d}"/>`;
}
/** How far the painted edge can reach past the panel's straight edge. */
const PAINT_REACH = 1.0;

/** Masking tape over a corner: a strip along the diagonal, its torn end `len` in from the corner. */
function tapeSvg(c: Ctx, cx: number, cy: number, angle: number, len: number, w: number) {
  const ux = Math.cos((angle * Math.PI) / 180), uy = Math.sin((angle * Math.PI) / 180);
  const P = (s: number, t: number) => `${n2(cx + s * ux - t * uy)} ${n2(cy + s * uy + t * ux)}`;
  let d = `M${P(-len, -w / 2)}L${P(len, -w / 2)}`;
  for (let j = 1; j <= 6; j++) d += `L${P(len + (j % 2 ? -w * 0.1 : w * 0.02), -w / 2 + (w * j) / 6)}`;
  d += `L${P(-len, w / 2)}Z`;
  const pts = [[-len, -w / 2], [len + w * 0.02, -w / 2], [len + w * 0.02, w / 2], [-len, w / 2]].map(([s, t]) => [cx + s * ux - t * uy, cy + s * uy + t * ux] as [number, number]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  c.boxes.push({ k: "tape", x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), pts });
  return `<path fill="${c.C.tape}" d="${d}"/>`;
}
/** Distance from the corner along the diagonal that a tape strip of reach `len` and width `w` covers. */
const tapeCover = (len: number, w: number) => len + w * 0.1;

/** The event line: the venue or show, with "until Nov 22" on the Event edition. */
function eventLine(d: Design, fx: Set<ExtraKey>) {
  const ev = d.ev.trim();
  if (!ev || !(d.evPrint || fx.has("event"))) return "";
  if (fx.has("event") && d.evDate) {
    const dt = new Date(`${d.evDate}T12:00:00Z`);
    if (!Number.isNaN(dt.getTime())) return `${ev} · until ${dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  }
  return ev;
}

/** "Dyann Klein · Edition of 25": long names end in an ellipsis, the edition stays. */
function artistLine(f: Fonts, art: ArtInfo, size: number, maxW: number) {
  const ed = art.edition ? ` · Edition of ${art.edition}` : "";
  if (width(f.body, art.artist + ed, size) <= maxW) return art.artist + ed;
  const room = maxW - width(f.body, ed, size);
  return room > size * 3 ? fit(f.body, art.artist, size, room) + ed : fit(f.body, art.artist + ed, size, maxW);
}

/**
 * Title, then the body lines under it (artist, event), left-aligned from (x, y) = the title's cap top.
 * thumb "side": a square to the right of the title. "top": a square above the title. The title shrinks (then wraps
 * to `maxLines`, then ends in an ellipsis) until everything stays above `limit`.
 */
function topBlock(c: Ctx, o: { x: number; y: number; w: number; limit: number; Ts: number; Tmin: number; maxLines: number; Bs: number; thumb?: "side" | "top" | null; thumbS?: number }) {
  const { f, d, art, C } = c;
  const dcap = capHeight(f.display), bcap = capHeight(f.body), lh = o.Bs * 1.32;
  const ev = eventLine(d, c.fx);
  const body: ("artist" | string)[] = [];
  if (d.showTitle) {
    body.push("artist");
    // "Edition of 25" shares the artist line when both fit; otherwise it gets the next line.
    const roomW = o.thumb === "side" && o.thumbS ? o.w - o.thumbS - o.Bs * 0.8 : o.w;
    if (art.edition && width(f.body, `${art.artist} · Edition of ${art.edition}`, o.Bs) > roomW) body.push(`Edition of ${art.edition}`);
  }
  if (ev) body.push(ev);
  let svg = "", y = o.y;
  const S = o.thumbS || 0;
  if (o.thumb === "top" && S) { svg += thumbSvg(c, o.x, y, S, S); y += S + o.Bs * 1.1; }
  const side = o.thumb === "side" && S ? S : 0, sideGap = side ? o.Bs * 0.8 : 0;
  const tW = o.w - side - sideGap;
  const bodyH = (Ts: number) => (body.length ? 0.3 * Ts + 1.05 * o.Bs + (body.length - 1) * lh + 0.24 * o.Bs : 0);
  let base = y, Ts = 0;
  if (d.showTitle) {
    const blk = fitBlock(f.display, art.title, {
      max: o.Ts, min: o.Tmin, maxW: tW, maxH: 1e6, lh: 0.98, maxLines: o.maxLines,
      fits: (s, k) => Math.max(y + dcap * s + (k - 1) * s * 0.98 + bodyH(s), side ? y + side : 0) <= o.limit,
    });
    Ts = blk.size;
    // The first line's highest glyph sits on y; each line's first glyph sits on x (optical alignment, to the ink).
    base = y - Math.min(...blk.lines.slice(0, 1).map((l) => ink(f.display, l, Ts).y1));
    blk.lines.forEach((line, i) => {
      if (i) base += Ts * 0.98;
      const b = ink(f.display, line, Ts);
      svg += text(f.display, line, o.x - b.x1, base, Ts, C.text);
      c.boxes.push({ k: "title", x: o.x, y: base + b.y1, w: b.x2 - b.x1, h: b.y2 - b.y1 });
    });
    base += 0.3 * Ts + 1.05 * o.Bs;
  } else {
    base = y + bcap * o.Bs;
  }
  let bottom = d.showTitle ? base - 1.05 * o.Bs - 0.3 * Ts + Ts * 0.22 : y;
  body.forEach((b, i) => {
    if (i) base += lh;
    const beside = side && base - bcap * o.Bs < y + side + 1;
    const w = beside ? tW : o.w;
    const t = b === "artist" ? (body.length > 1 && body[1].startsWith("Edition of") ? fit(f.body, art.artist, o.Bs, w) : artistLine(f, art, o.Bs, w)) : fit(f.body, b, o.Bs, w);
    const bx = ink(f.body, t, o.Bs).x1;
    svg += text(f.body, t, o.x - bx, base, o.Bs, C.text);
    c.boxes.push(bodyBox(o.x, base, width(f.body, t, o.Bs) - bx, o.Bs, f));
    bottom = base + 0.24 * o.Bs;
  });
  if (side) { svg += thumbSvg(c, o.x + o.w - side, y, side, side); bottom = Math.max(bottom, y + side); }
  return { svg, bottom, Ts: Ts || o.Bs };
}

/** The pill: one solid rounded shape, message centred, bottom edge at `bottom`. Wraps to two lines before shrinking. */
function pillSvg(c: Ctx, x: number, bottom: number, w: number, Bs: number, padY: number, padX: number, kind: "pill" | "wide") {
  const { f, d, art, C } = c;
  const lines = wrapLine(f, messageLines(d, art, kind)[0], Bs, w - 2 * padX, 2);
  const lh = Bs * 1.32, h = 2 * padY + lh * lines.length, top = bottom - h, r = (2 * padY + lh) / 2;
  const bcap = capHeight(f.body) * Bs, vis = bcap + (lines.length - 1) * lh;
  let s = `<rect x="${n2(x)}" y="${n2(top)}" width="${n2(w)}" height="${n2(h)}" rx="${n2(r)}" fill="${C.accent}"/>`;
  c.boxes.push({ k: "pill", x, y: top, w, h });
  let base = top + h / 2 - vis / 2 + bcap;
  for (const l of lines) { s += drawLine(f, l, x + w / 2, base, Bs, C.onAccent, C.onAccent, "middle"); base += lh; }
  return { svg: s, top, h };
}

/** The two-line message ("Scan for prints" / "from $55"), last baseline at `lastBase`. */
function twoLineSvg(c: Ctx, x: number, lastBase: number, w: number, Bs: number, lh: number, opt: { brush?: boolean; fill: string; price: string; anchor?: "start" | "middle" }) {
  const { f, d, art } = c;
  const lines = messageLines(d, art, "two").map((l) => clampLine(f, l, Bs, w));
  // `lastBase` is where the ink should end: the last line's lowest glyph sits on it (the brush has its own drop).
  if (!opt.brush) lastBase -= lineInk(f, lines[lines.length - 1], Bs).y2;
  let s = "", base = lastBase - (lines.length - 1) * lh;
  const top = base - capHeight(f.body) * Bs;
  lines.forEach((l, i) => {
    const li = lineInk(f, l, Bs), lw = segW(f, l, Bs), mid = opt.anchor === "middle";
    const lx = mid ? x - lw / 2 : x, dx = mid ? 0 : li.x1;
    if (opt.brush && i === lines.length - 1) s += brushUnder(c, lx, base, lw, Bs);
    s += drawLine(f, l, x - dx, base, Bs, opt.fill, opt.price, opt.anchor);
    c.boxes.push(bodyBox(lx, base, lw, Bs, f));
    base += lh;
  });
  return { svg: s, top };
}

const plateSvg = (c: Ctx, x: number, y: number, s: number, r: number) => { c.boxes.push({ k: "plate", x, y, w: s, h: s }); return `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(s)}" height="${n2(s)}" rx="${n2(r)}" fill="${c.C.bg}"/>`; };
/** Code size on a plate of side `s` that leaves 2.2 modules of quiet zone all round. */
const onPlate = (s: number, n: number) => (s * n) / (n + 4.4);

// ---------------- seasonal motifs ----------------
/** One motif centred on (0, 0), about 2 units across. Flat shapes only (print safe). */
function motifPath(shape: (typeof SEASONS)[SeasonKey]["shape"], fill: string, accent: string) {
  switch (shape) {
    case "flake": {
      let d = "";
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3, ux = Math.cos(a), uy = Math.sin(a);
        d += `M${n2(-ux)} ${n2(-uy)}L${n2(ux)} ${n2(uy)}`;
        for (const sgn of [-1, 1]) {
          const bx = ux * 0.55 * sgn, by = uy * 0.55 * sgn;
          for (const t of [-0.5, 0.5]) { const b = a + (sgn > 0 ? 0 : Math.PI) + t * 1.6; d += `M${n2(bx)} ${n2(by)}L${n2(bx + Math.cos(b) * 0.38)} ${n2(by + Math.sin(b) * 0.38)}`; }
        }
      }
      return `<path d="${d}" fill="none" stroke="${fill}" stroke-width=".2" stroke-linecap="round"/>`;
    }
    case "confetti": return `<rect x="-.9" y="-.35" width="1.8" height=".7" rx=".2" fill="${fill}"/>`;
    case "heart": return `<path fill="${fill}" d="M0 .9C-.2.7-1 .2-1-.3-1-.8-.55-1-.3-1-.12-1 0-.85 0-.7 0-.85.12-1 .3-1 .55-1 1-.8 1-.3 1 .2.2.7 0 .9Z"/>`;
    case "bloom": {
      let d = "";
      for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5; d += `M${n2(Math.cos(a) * 0.52 + 0.42)} ${n2(Math.sin(a) * 0.52)}a.42 .42 0 1 0-.84 0a.42 .42 0 1 0 .84 0Z`; }
      return `<path fill="${fill}" d="${d}"/><circle r=".3" fill="${accent}"/>`;
    }
    case "sun": {
      let d = "";
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; d += `M${n2(Math.cos(a) * 0.7)} ${n2(Math.sin(a) * 0.7)}L${n2(Math.cos(a) * 1)} ${n2(Math.sin(a) * 1)}`; }
      return `<circle r=".48" fill="${fill}"/><path d="${d}" stroke="${fill}" stroke-width=".18" stroke-linecap="round"/>`;
    }
    case "leaf": return `<path fill="${fill}" d="M0-1C.55-.55.6.35 0 .75-.6.35-.55-.55 0-1Z"/><path d="M0 .7V1" stroke="${fill}" stroke-width=".14" stroke-linecap="round"/>`;
  }
}

/**
 * The season's motifs as a garland along the margin band, evenly spaced, skipping any spot within 2.2 modules of the
 * code (its clear area stays untouched) or near words, the plate, the hole or the tape. Deterministic per card.
 */
function seasonSvg(c: Ctx, out: Out, d: Design): string {
  const S = SEASONS[d.season as SeasonKey];
  const W = out.W, H = out.H, round = d.format === "sticker";
  const r = round ? 3.1 : d.format === "poster" ? 12 : 2.9;
  const code = c.boxes.find((b) => b.k === "code")!;
  const qz = 2.2 * (code.w / c.n);
  const panel = c.boxes.find((b) => b.k === "panel");
  if (panel && round) return ""; // the round Panel is one solid circle: nothing goes on it
  const black = d.ink === "black" && lum(d.accent) < 0.02;
  const gap = d.format === "poster" ? 18 : 3;
  const near = (b: Box, x: number, y: number, pad: number) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
  const hash = (i: number) => { const v = Math.sin(i * 12.9898 + (c.art.slug.length + 3) * 78.233) * 43758.5453; return v - Math.floor(v); };
  // Points along a line inset `e` from the edge (a rectangle, or a circle for the sticker).
  const e = round ? 9.5 : Math.max(r + 2.4, (out.m || 11.2) / 2), step = r * (round ? 4.6 : 6.2);
  const pts: [number, number][] = [];
  if (round) {
    const R = W / 2 - e, n = Math.floor((2 * Math.PI * R) / step);
    for (let k = 0; k < n; k++) { const t = (k / n) * 2 * Math.PI; pts.push([W / 2 + R * Math.cos(t), H / 2 + R * Math.sin(t)]); }
  } else {
    const run = (x0: number, y0: number, x1: number, y1: number) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step)); for (let k = 0; k < n; k++) pts.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]); };
    run(e, e, W - e, e); run(W - e, e, W - e, H - e); run(W - e, H - e, e, H - e); run(e, H - e, e, e);
  }
  let s = "";
  pts.forEach(([x, y], i) => {
    if (near(code, x, y, qz + r)) return;
    if (c.boxes.some((b) => b !== code && b.k !== "panel" && (b.pts ? near(b, x, y, r + 1) : near(b, x, y, b.k === "plate" ? r + 2 : gap + r)))) return;
    if (d.format === "tag" && Math.hypot(x - W / 2, y - 12.4) < 5.2 + r + 3) return;
    let fill = black ? "#000000" : S.motif[i % S.motif.length], accent = black ? "#ffffff" : S.motif[S.motif.length - 1];
    if (panel) {
      const inside = near(panel, x, y, 0);
      if (!(inside ? near(panel, x, y, -(r + 4)) : !near(panel, x, y, r + 4))) return;
      if (inside) { fill = c.C.onAccent; accent = c.C.accent; }
    }
    const k = r * (0.85 + hash(i) * 0.3), rot = Math.round(hash(i + 11) * 360);
    s += `<g transform="translate(${n2(x)} ${n2(y)}) rotate(${rot}) scale(${n2(k)})">${motifPath(S.shape, fill, accent)}</g>`;
    c.boxes.push({ k: "motif", x: x - k, y: y - k, w: 2 * k, h: 2 * k });
  });
  return s;
}

export type Card = { inner: string; w: number; h: number; qrPt: number; ctaPt: number; label: string; mods: number; boxes: Box[]; m: number };

// ---------------- faces ----------------
export function renderCard(d: Design, art: ArtInfo, f: Fonts, qrText: string, uid = "c"): Card {
  const fx = new Set(d.extras.filter((k) => EXTRAS[k].formats.includes(d.format)));
  const style = styleOf(d);
  if (style !== "panel" || d.format === "sticker") fx.delete("painted");
  const c: Ctx = { d, art, f, qrText, uid, n: codeModules(d, qrText), C: cardColors(d), style, fx, boxes: [], defs: [] };
  const out = d.format === "label" ? label(c) : d.format === "tag" ? tag(c) : d.format === "sticker" ? sticker(c) : poster(c);
  if (d.season) out.svg += seasonSvg(c, out, d);
  const msg = messageLines(d, art, style === "pill" ? "pill" : "two").map(plain).join(" ");
  const lbl = `${FORMATS[d.format].name}: ${d.showTitle ? `${art.title} by ${art.artist}. ` : ""}${msg}.`;
  const inner = (c.defs.length ? `<defs>${c.defs.join("")}</defs>` : "") + out.svg;
  return { inner, w: out.W, h: out.H, qrPt: out.Q, ctaPt: out.Ts, label: lbl, mods: c.n, boxes: c.boxes, m: out.m };
}
type Out = { svg: string; W: number; H: number; Q: number; Ts: number; m: number };

/** Clip everything to the card's shape (panels and tape bleed off the edge). */
function clipped(c: Ctx, shape: string, body: string) {
  const id = `qs-clip-${c.uid}`;
  c.defs.push(`<clipPath id="${id}">${shape}</clipPath>`);
  return `<g clip-path="url(#${id})">${body}</g>`;
}

// 3.5 × 2 in. Code on the left, as tall as the card allows; title and artist top right, the message bottom right,
// tops and bottoms flush with the code. Panel: the code on a white plate in a solid panel that bleeds off the left.
function label(c: Ctx): Out {
  const { C, n, style, fx } = c;
  const W = 252, H = 144, R = 5.6, Bs = 9.2, lh = Bs * 1.32, TL = 17, TW = 13;
  const tape = fx.has("tape");
  let m = 11.2, Q = 0, colX: number, s = "";
  if (style === "panel") {
    const P = 120, g = 6.4, plateS = P - 2 * g, py = (H - plateS) / 2;
    Q = onPlate(plateS, n);
    s += `<rect width="${P}" height="${H}" fill="${C.accent}"/>`;
    c.boxes.push({ k: "panel", x: 0, y: 0, w: P, h: H });
    if (fx.has("painted")) s += paintedEdge(H, 7, C.accent, `matrix(0 1 1 0 ${P} 0)`);
    s += plateSvg(c, g, py, plateS, 6.4) + codeSvg(c, g + (plateS - Q) / 2, py + (plateS - Q) / 2, Q);
    colX = P + 12 + (fx.has("painted") ? 7 * PAINT_REACH : 0);
    if (tape) m = Math.max(m, tapeCover(TL, TW) / Math.SQRT2 + 3);
  } else {
    // The margin is the quiet zone: at least 2 modules, and clear of the tape when it's on.
    for (let i = 0; i < 5; i++) { Q = H - 2 * m; const mod = Q / n; m = Math.max(11.2, 2.1 * mod, tape ? (tapeCover(TL, TW) + 2.2 * mod) / Math.SQRT2 : 0); }
    Q = H - 2 * m;
    s += codeSvg(c, m, m, Q);
    colX = m + Q + m;
  }
  const colW = W - m - colX, bottom = H - m;
  let msgTop: number;
  if (style === "pill") { const p = pillSvg(c, colX, bottom, colW, Bs, 4.8, 8, "pill"); s += p.svg; msgTop = p.top; }
  else { const t = twoLineSvg(c, colX, style === "brush" ? bottom - BRUSH_DROP * Bs : bottom, colW, Bs, lh, { brush: style === "brush", fill: C.text, price: style === "clean" ? C.price : C.text }); s += t.svg; msgTop = t.top; }
  const tb = topBlock(c, { x: colX, y: m, w: colW, limit: msgTop - 7, Ts: 17.6, Tmin: 10.5, maxLines: 2, Bs, thumb: fx.has("thumb") ? "side" : null, thumbS: Math.min(34, colW * 0.34) });
  s += tb.svg;
  if (tape) s += tapeSvg(c, 0, 0, 41, TL, TW) + tapeSvg(c, W, 0, 138, TL, TW);
  const shape = `<rect width="${W}" height="${H}" rx="${R}"/>`;
  return { svg: `<rect width="${W}" height="${H}" rx="${R}" fill="${C.bg}"/>` + clipped(c, shape, s), W, H, Q, Ts: tb.Ts, m };
}

// 2 × 3.5 in, hole at the top. Pill: the code full width under the hole, title and artist under it, the pill at the
// bottom. Panel: the code on a white plate in a solid top panel, the words below.
function tag(c: Ctx): Out {
  const { C, n, style, fx } = c;
  const W = 144, H = 252, R = 8.8, Bs = 8.8, lh = Bs * 1.32, holeY = 12.4, holeR = 5.2, TL = 17, TW = 13;
  let m = 11.2, s = "", Q: number, textTop: number, msgTop: number;
  const thumb = fx.has("thumb") ? "side" as const : null;
  if (style === "panel") {
    const side = 14.4, plateY = 24.8;
    let plateS = W - 2 * side;
    // Words first, bottom up, so the plate can give way to a long title.
    const two = twoLineSvg(c, m, H - m, W - 2 * m, Bs, lh, { fill: C.text, price: C.text });
    msgTop = two.top;
    const need = (ps: number) => plateY + ps + 8.8 + m;
    const probe = topBlock({ ...c, boxes: [], defs: [] }, { x: m, y: need(plateS), w: W - 2 * m, limit: msgTop - 7, Ts: 16, Tmin: 10, maxLines: 2, Bs, thumb, thumbS: 30 });
    if (probe.bottom > msgTop - 7) plateS = Math.max(80, plateS - (probe.bottom - (msgTop - 7)));
    Q = onPlate(plateS, n);
    const panelB = plateY + plateS + 8.8;
    s += `<rect width="${W}" height="${n2(panelB)}" fill="${C.accent}"/>`;
    c.boxes.push({ k: "panel", x: 0, y: 0, w: W, h: panelB });
    if (fx.has("painted")) s += paintedEdge(W, 7, C.accent, `matrix(1 0 0 1 0 ${n2(panelB)})`);
    const px = (W - plateS) / 2;
    s += plateSvg(c, px, plateY, plateS, 6.4) + codeSvg(c, px + (plateS - Q) / 2, plateY + (plateS - Q) / 2, Q);
    textTop = panelB + m + (fx.has("painted") ? 7 * PAINT_REACH : 0);
    s += two.svg;
  } else {
    for (let i = 0; i < 4; i++) { Q = W - 2 * m; m = Math.max(11.2, 2.1 * (Q / n)); }
    Q = W - 2 * m;
    const p = pillSvg(c, m, H - m, W - 2 * m, Bs, 4.8, 6, "pill");
    s += p.svg; msgTop = p.top;
    const mod = Q / n, codeY = Math.max(24.8, holeY + holeR + 2.2 * mod), gap = Math.max(10, 2.2 * mod);
    const probe = topBlock({ ...c, boxes: [], defs: [] }, { x: m, y: codeY + Q + gap, w: W - 2 * m, limit: msgTop - 7, Ts: 16, Tmin: 10, maxLines: 2, Bs, thumb, thumbS: 30 });
    if (probe.bottom > msgTop - 7) Q = Math.max(84, Q - (probe.bottom - (msgTop - 7)));
    s += codeSvg(c, (W - Q) / 2, codeY, Q);
    textTop = codeY + Q + gap;
  }
  const tb = topBlock(c, { x: m, y: textTop, w: W - 2 * m, limit: msgTop - 7, Ts: 16, Tmin: 10, maxLines: 2, Bs, thumb, thumbS: 30 });
  s += tb.svg;
  if (fx.has("tape")) s += tapeSvg(c, 0, 0, 47, TL, TW) + tapeSvg(c, W, 0, 133, TL, TW);
  const shape = `<rect width="${W}" height="${H}" rx="${R}"/>`;
  const id = `qs-hole-${c.uid}`;
  c.defs.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/><circle cx="${W / 2}" cy="${holeY}" r="${holeR}" fill="#000"/></mask>`);
  // The hole is cut out; a thin ring marks where to punch it.
  const ring = `<circle cx="${W / 2}" cy="${holeY}" r="${holeR}" fill="none" stroke="${style === "panel" ? C.onAccent : C.text}" stroke-width=".5"/>`;
  return { svg: `<g mask="url(#${id})"><rect width="${W}" height="${H}" rx="${R}" fill="${C.bg}"/>${clipped(c, shape, s)}</g>${ring}`, W, H, Q, Ts: tb.Ts, m };
}

// 2 in circle. Pill: title over the code, the pill under it, all on one centre line. Panel: one solid circle, the
// code on a white plate, the message under it.
function sticker(c: Ctx): Out {
  const { f, d, art, C, n, style, fx } = c;
  const S = 144, Cc = 72, R = 72;
  const dcap = capHeight(f.display), bcap = capHeight(f.body);
  const chord = (y: number) => 2 * Math.sqrt(Math.max(0, R * R - (y - Cc) ** 2));
  const ev = eventLine(d, fx);
  let s = "", Q: number, Ts = 0;
  if (style === "panel") {
    const Bs = 8, lh = Bs * 1.25;
    s += `<circle cx="${Cc}" cy="${Cc}" r="${R}" fill="${C.accent}"/>`;
    c.boxes.push({ k: "panel", x: 0, y: 0, w: S, h: S });
    const msg = messageLines(d, art, "two");
    const lines: RLine[] = [...(ev ? [[{ t: ev }]] : []), ...msg];
    const textH = bcap * Bs + (lines.length - 1) * lh;
    const gap = 6.4;
    const plateS = Math.min(76.8, 116 - textH - gap);
    const top = Cc - (plateS + gap + textH) / 2 + 1.5;
    const px = Cc - plateS / 2;
    Q = onPlate(plateS, n);
    s += plateSvg(c, px, top, plateS, 6.4) + codeSvg(c, Cc - Q / 2, top + (plateS - Q) / 2, Q);
    let base = top + plateS + gap + bcap * Bs;
    for (const l of lines) {
      const w = chord(base) - 22, ll = clampLine(f, l, Bs, w), lw = segW(f, ll, Bs);
      s += drawLine(f, ll, Cc, base, Bs, C.onAccent, C.onAccent, "middle");
      c.boxes.push(bodyBox(Cc - lw / 2, base, lw, Bs, f));
      base += lh;
    }
    return { svg: s, W: S, H: S, Q, Ts: Bs, m: 0 };
  }
  // Pill
  const Bs = 7.2, padY = 3.2, pillW = 78.4;
  const pillH = 2 * padY + Bs * 1.32 * wrapLine(f, messageLines(d, art, "pill")[0], Bs, pillW - 12, 2).length;
  const evH = ev ? Bs * 1.32 : 0;
  // Title: one line down to 9 pt, then two balanced lines down to 8 pt, then an ellipsis.
  const tW = 78;
  let tLines: string[] = [], Ts0 = 11.2;
  if (d.showTitle) {
    while (Ts0 > 9 && width(f.display, art.title, Ts0) > tW + 6) Ts0 *= 0.96;
    if (width(f.display, art.title, Ts0) <= tW + 6) tLines = [art.title];
    else { const b = fitBlock(f.display, art.title, { max: 10, min: 8, maxW: tW, maxH: 1e6, lh: 0.98, maxLines: 2 }); tLines = b.lines; Ts0 = b.size; }
  }
  const titleH = d.showTitle ? dcap * Ts0 + (tLines.length - 1) * Ts0 * 0.98 : 0;
  let g1 = 0, g2 = 0, y = 0;
  // Biggest code (up to the mockup's 64 pt, 72 without a title) whose stack keeps the pill's corners inside the circle.
  for (Q = d.showTitle ? 64 : 72; Q > 44; Q -= 1) {
    const mod = Q / n;
    g1 = Math.max(6.5, 2.2 * mod + 2); g2 = Math.max(10, 2.2 * mod);
    const stack = (d.showTitle ? titleH + g1 : 0) + evH + (ev && !d.showTitle ? g1 : 0) + Q + g2 + pillH;
    y = Cc - stack / 2 + 1;
    const pb = y + stack, r = padY + Bs * 0.66, corner = Math.hypot(pillW / 2 - r, pb - r - Cc) + r;
    if (corner <= 67 && Math.hypot(Q / 2, y + stack - pillH - g2 - Cc) <= 66) break;
  }
  s += `<circle cx="${Cc}" cy="${Cc}" r="${R}" fill="${C.bg}"/>`;
  if (d.showTitle) {
    Ts = Ts0;
    let base = y + dcap * Ts;
    tLines.forEach((line, i) => {
      if (i) base += Ts * 0.98;
      const t = fit(f.display, line, Ts, Math.max(tW, chord(base - dcap * Ts) - 20)), tw = width(f.display, t, Ts);
      s += text(f.display, t, Cc, base, Ts, C.text, "middle");
      c.boxes.push({ k: "title", x: Cc - tw / 2, y: base - dcap * Ts * 1.05, w: tw, h: dcap * Ts * 1.05 + Ts * 0.22 });
    });
    y = base;
  }
  if (ev) {
    const base = y + (d.showTitle ? Bs * 1.32 : bcap * Bs);
    const t = fit(f.body, ev, Bs, chord(base) - 26), tw = width(f.body, t, Bs);
    s += text(f.body, t, Cc, base, Bs, C.text, "middle");
    c.boxes.push(bodyBox(Cc - tw / 2, base, tw, Bs, f));
    y = base;
  }
  if (d.showTitle || ev) y += g1;
  s += codeSvg(c, Cc - Q / 2, y, Q);
  y += Q + g2;
  s += pillSvg(c, Cc - pillW / 2, y + pillH, pillW, Bs, padY, 6, "pill").svg;
  return { svg: s, W: S, H: S, Q, Ts: Ts || Bs, m: 0 };
}

// 8.5 × 11 in, ¾ in margins. Pill: big title, big code, the message once in a full-width pill. Panel: the title on
// white, then a solid panel across the bottom with the message and the code on a plate.
function poster(c: Ctx): Out {
  const { f, C, n, style, fx } = c;
  const W = 612, H = 792, m = 52.8, cw = W - 2 * m, Bs = 30, TL = 60, TW = 46;
  const bcap = capHeight(f.body);
  const thumb = fx.has("thumb") ? "top" as const : null, thumbS = 96;
  let s = `<rect width="${W}" height="${H}" fill="${C.bg}"/>`, Q: number, tb: ReturnType<typeof topBlock>;
  if (style === "panel") {
    const msgLines = wrapLine(f, messageLines(c.d, c.art, "wide")[0], Bs, cw, 2), lh = Bs * 1.32;
    const msgH = bcap * Bs + (msgLines.length - 1) * lh;
    const minPlate = 280, gapMP = 40, reach = fx.has("painted") ? 20 * PAINT_REACH : 0;
    const limit = H - m - minPlate - gapMP - msgH - 0.8 * m - 30 - reach;
    tb = topBlock(c, { x: m, y: m, w: cw, limit, Ts: 69.6, Tmin: 34, maxLines: 3, Bs, thumb, thumbS });
    const panelTop = Math.max(276, tb.bottom + 30 + reach);
    let base = panelTop + 0.8 * m + bcap * Bs;
    let panel = `<rect y="${n2(panelTop)}" width="${W}" height="${n2(H - panelTop)}" fill="${C.accent}"/>`;
    c.boxes.push({ k: "panel", x: 0, y: panelTop, w: W, h: H - panelTop });
    if (fx.has("painted")) panel += paintedEdge(W, 20, C.accent, `matrix(1 0 0 -1 0 ${n2(panelTop)})`);
    s += panel;
    for (const l of msgLines) { const dx = lineInk(f, l, Bs).x1; s += drawLine(f, l, m - dx, base, Bs, C.onAccent, C.onAccent); c.boxes.push(bodyBox(m, base, segW(f, l, Bs) - dx, Bs, f)); base += lh; }
    base -= lh;
    const plateS = Math.min(357.6, H - m - (base + gapMP));
    Q = onPlate(plateS, n);
    const py = H - m - plateS;
    s += plateSvg(c, m, py, plateS, 24) + codeSvg(c, m + (plateS - Q) / 2, py + (plateS - Q) / 2, Q);
  } else {
    const p = pillSvg(c, m, H - m, cw, Bs, 19.2, 24, "wide");
    const minQ = 300;
    const gap1 = 33.6;
    let gap2 = Math.max(33.6, 2.2 * (minQ / n));
    tb = topBlock(c, { x: m, y: m, w: cw, limit: p.top - gap2 - minQ - gap1, Ts: 69.6, Tmin: 34, maxLines: 3, Bs, thumb, thumbS });
    const codeY = tb.bottom + gap1;
    Q = Math.min(cw, p.top - gap2 - codeY);
    gap2 = Math.max(gap2, 2.2 * (Q / n));
    Q = Math.min(cw, p.top - gap2 - codeY);
    s += codeSvg(c, m, codeY, Q) + p.svg;
  }
  s += tb.svg;
  if (fx.has("tape")) s += tapeSvg(c, 0, 0, 41, TL, TW) + tapeSvg(c, W, 0, 138, TL, TW);
  return { svg: clipped(c, `<rect width="${W}" height="${H}"/>`, s), W, H, Q, Ts: tb.Ts, m };
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

/** Each card's ids are made unique per copy on a sheet by `uid`; <use> shares one copy, so this keeps it simple. */
export function sheetSVG(c: Card, fmt: FormatKey, uid = "s") {
  const L = sheetLayout(fmt);
  const id = `qs-card-${uid}`;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="8.5in" height="11in" role="img" aria-label="Print sheet: ${L.slots.length} × ${esc(c.label)}">` +
    `<rect width="${L.W}" height="${L.H}" fill="#fff"/><defs><symbol id="${id}" viewBox="0 0 ${c.w} ${c.h}">${c.inner}</symbol></defs>`;
  for (const p of L.slots) s += `<use href="#${id}" x="${n2(p.x)}" y="${n2(p.y)}" width="${c.w}" height="${c.h}"/>`;
  if (L.marks.length) s += `<path stroke="#000" stroke-width=".5" fill="none" d="${L.marks.map((m) => `M${m[0]} ${m[1]}L${m[2]} ${m[3]}`).join("")}"/>`;
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
  if (L.marks.length) s += `<path stroke="#000" stroke-width=".5" fill="none" d="${L.marks.map((m) => `M${m[0]} ${m[1]}L${m[2]} ${m[3]}`).join("")}"/>`;
  return s + "</svg>";
}

// ---------------- scan maths ----------------
/** `logo` is only a fallback for cards made before `mods` was recorded. */
export function scanNumbers(c: Card, qrText: string, f: Fonts, logo = false) {
  const n = c.mods || qrMatrix(qrText, logo ? "H" : "M").length;
  // qrPt is the code's own size (drawn without a white border; the card's margin or plate is the quiet zone).
  const qrIn = c.qrPt / 72, modIn = qrIn / n, codeIn = qrIn;
  const capIn = (c.ctaPt * capHeight(f.display)) / 72;
  return { n, modMm: modIn * 25.4, codeIn, scanCm: codeIn * 2.54 * 10, readM: capIn * 3.05 };
}
export function fmtDist(cm: number) {
  return cm >= 100 ? (cm / 100).toFixed(1).replace(/\.0$/, "") + " m" : Math.round(cm / 5) * 5 + " cm";
}
