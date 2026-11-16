// Embed options, shared by the iframe routes (/embed/artist, /embed/collection, /embed/art), the snippet builder
// and public/embed.js (which copies data-* attributes onto the iframe's query string, so the server is the only parser).
// Pure module: safe on server and client.
import { PAINTS } from "@/components/artist/theme";

export type EmbedLayout = "grid" | "carousel" | "single";
export type EmbedTheme = "light" | "dark" | "auto";

export type EmbedOptions = {
  layout: EmbedLayout;
  /** Columns in the grid, or pieces per view in the carousel. 0 = as many as fit. */
  columns: number;
  /** How many pieces to show (single layout always shows one). */
  count: number;
  theme: EmbedTheme;
  /** A paint id from the artist page palette or "#rrggbb". null = the artist's own page accent. */
  accent: string | null;
  prices: boolean;
  /** The artist (or collection) header above the pieces. */
  header: boolean;
};

export const EMBED_DEFAULTS: EmbedOptions = { layout: "grid", columns: 0, count: 6, theme: "light", accent: null, prices: true, header: true };
export const MAX_COLUMNS = 6;
export const MAX_COUNT = 50;

/** Query keys the embed routes read. embed.js forwards data-<key> for each (plus data-limit, the old name for count). */
export const OPTION_KEYS = ["layout", "columns", "count", "theme", "accent", "prices", "header"] as const;

type Source = URLSearchParams | Record<string, string | string[] | null | undefined>;

function read(q: Source, key: string): string | null {
  if (q instanceof URLSearchParams) return q.get(key);
  const v = q[key];
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

const YES = /^(1|true|yes|on|show)$/i;
const NO = /^(0|false|no|off|hide|none)$/i;

export function parseBool(v: string | null | undefined, fallback: boolean): boolean {
  const s = (v ?? "").trim();
  if (YES.test(s)) return true;
  if (NO.test(s)) return false;
  return fallback;
}

function parseIntIn(v: string | null, min: number, max: number, fallback: number): number {
  if (v == null || v.trim() === "") return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** "ultramarine", "#2B37F0", "2b37f0" or "#23f" → a paint id or "#rrggbb". "page", empty or junk → null. */
export function parseAccent(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase();
  if (!s || s === "page") return null;
  if (PAINTS.some((p) => p.id === s)) return s;
  const hex = s.replace(/^#/, "");
  if (/^[0-9a-f]{6}$/.test(hex)) return "#" + hex;
  if (/^[0-9a-f]{3}$/.test(hex)) return "#" + hex.split("").map((c) => c + c).join("");
  return null;
}

export function parseEmbedOptions(q: Source): EmbedOptions {
  const d = EMBED_DEFAULTS;
  const layoutRaw = (read(q, "layout") ?? "").toLowerCase();
  const layout: EmbedLayout = layoutRaw === "carousel" || layoutRaw === "single" || layoutRaw === "grid" ? layoutRaw : d.layout;
  const themeRaw = (read(q, "theme") ?? "").toLowerCase();
  const theme: EmbedTheme = themeRaw === "dark" || themeRaw === "auto" || themeRaw === "light" ? themeRaw : d.theme;
  const count = parseIntIn(read(q, "count") ?? read(q, "limit"), 1, MAX_COUNT, d.count);
  return {
    layout,
    columns: parseIntIn(read(q, "columns"), 0, MAX_COLUMNS, d.columns),
    count: layout === "single" ? 1 : count,
    theme,
    accent: parseAccent(read(q, "accent")),
    prices: parseBool(read(q, "prices"), d.prices),
    header: parseBool(read(q, "header"), d.header),
  };
}

/** Only the options that differ from the defaults, as [key, value] pairs, in a stable order. */
export function optionPairs(o: Partial<EmbedOptions>): [string, string][] {
  const full = { ...EMBED_DEFAULTS, ...o };
  const out: [string, string][] = [];
  if (full.layout !== EMBED_DEFAULTS.layout) out.push(["layout", full.layout]);
  if (full.layout !== "single") {
    if (full.columns !== EMBED_DEFAULTS.columns) out.push(["columns", String(full.columns)]);
    if (full.count !== EMBED_DEFAULTS.count) out.push(["count", String(full.count)]);
  }
  if (full.theme !== EMBED_DEFAULTS.theme) out.push(["theme", full.theme]);
  const accent = parseAccent(full.accent);
  if (accent) out.push(["accent", accent.replace(/^#/, "")]);
  if (!full.prices) out.push(["prices", "no"]);
  if (!full.header) out.push(["header", "no"]);
  return out;
}

/** "?layout=carousel&count=9", or "" when everything is default. */
export function embedQuery(o: Partial<EmbedOptions>, extra: [string, string][] = []): string {
  const s = new URLSearchParams([...optionPairs(o), ...extra]).toString();
  return s ? "?" + s : "";
}

/** ` data-layout="carousel" data-count="9"` for the embed.js snippet. Values are from a fixed set, so no escaping needed. */
export function embedDataAttrs(o: Partial<EmbedOptions>): string {
  return optionPairs(o).map(([k, v]) => ` data-${k}="${v}"`).join("");
}

// ---------------- accent color ----------------

export type Accent = { color: string; ink: string };

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const INK = "#15161b";
const WHITE = "#ffffff";

/** Text color for a button filled with `hex`: white or ink, whichever reads better. */
export function inkOn(hex: string) {
  return contrast(hex, WHITE) >= contrast(hex, INK) ? WHITE : INK;
}

/** The button color: an explicit option wins, else the artist's page accent (a paint id), else Garnet. */
export function resolveAccent(option: string | null, pageAccent?: string | null): Accent {
  const pick = parseAccent(option) ?? parseAccent(pageAccent) ?? PAINTS[0].id;
  const p = PAINTS.find((x) => x.id === pick);
  if (p) return { color: p.color, ink: p.ink };
  return { color: pick, ink: inkOn(pick) };
}

// ---------------- size ----------------

/** A starting height for an iframe before it reports its own (oEmbed and the no-script snippet use it). Rough, never exact. */
export function estimateHeight(o: EmbedOptions, width: number, count: number): number {
  const inner = Math.max(200, width - 30);
  const head = o.header ? 60 : 0;
  const foot = 30;
  const shown = Math.max(1, Math.min(count, o.layout === "single" ? 1 : o.count));
  if (o.layout === "single") return Math.round(30 + head + Math.min(520, inner * 1.1) + 28 + 110 + foot);
  const cardText = o.prices ? 92 : 74;
  if (o.layout === "carousel") {
    const cw = o.columns ? Math.max(130, (inner - (o.columns - 1) * 12) / o.columns) : Math.min(inner * 0.72, 220);
    return Math.round(30 + head + cw * 1.25 + cardText + 6 + foot + 24);
  }
  let cols = o.columns || Math.max(1, Math.floor((inner + 12) / (140 + 12)));
  while (cols > 1 && (inner - (cols - 1) * 12) / cols < 140) cols--;
  const cw = (inner - (cols - 1) * 12) / cols;
  const rows = Math.ceil(shown / cols);
  return Math.round(30 + head + rows * (cw * 1.25 + cardText) + (rows - 1) * 12 + foot + 24);
}
