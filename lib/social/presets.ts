// Video presets for the Share kit "Videos" section and Artfinity's own social posts (/admin/social).
// Pure and client-safe. Free artists get the first three; the rest need Infinity (lib/plans.ts isProActive).
// Drawing lives in components/share/videos/engine.ts; each preset there is a pure function of time.

export type PresetId =
  | "room-tour"
  | "closeup"
  | "price-card"
  | "gallery-walk"
  | "before-after"
  | "size-compare"
  | "carousel"
  | "countdown"
  | "seasonal";

export type VideoFormat = "vertical" | "square";
export const FORMATS: Record<VideoFormat, { label: string; w: number; h: number; ratio: string }> = {
  vertical: { label: "Vertical 9:16", w: 1080, h: 1920, ratio: "9 / 16" },
  square: { label: "Square 1:1", w: 1080, h: 1080, ratio: "1 / 1" },
};
export const isFormat = (v: unknown): v is VideoFormat => v === "vertical" || v === "square";

export type PresetDef = {
  id: PresetId;
  name: string;
  sub: string;
  tier: "free" | "infinity";
  /** Seconds, before the optional 1.5 s logo outro. Every preset stays between 6 and 15 s. */
  duration: number;
  /** "many" presets show several pieces (a walk, a carousel). */
  pieces: "one" | "many";
  dab: string;
};

export const PRESETS: PresetDef[] = [
  { id: "room-tour", name: "Room tour", sub: "Slow pans across real rooms with your piece on the wall", tier: "free", duration: 12, pieces: "one", dab: "#ff5a36" },
  { id: "closeup", name: "Close-up reveal", sub: "The full piece, then a slow zoom into the detail", tier: "free", duration: 10, pieces: "one", dab: "#ffd43b" },
  { id: "price-card", name: "Price card", sub: "Your piece, the price and a code to buy", tier: "free", duration: 8, pieces: "one", dab: "#2b37f0" },
  { id: "gallery-walk", name: "Gallery walk", sub: "A walk past several pieces on a gallery wall", tier: "infinity", duration: 13, pieces: "many", dab: "#0f7a55" },
  { id: "before-after", name: "Before and after", sub: "A bare wall, then the wall with your print", tier: "infinity", duration: 9, pieces: "one", dab: "#7b2d8e" },
  { id: "size-compare", name: "Size compare", sub: "Every print size next to a sofa or a person", tier: "infinity", duration: 11, pieces: "one", dab: "#c98a5a" },
  { id: "carousel", name: "Collection carousel", sub: "A collection, one piece after another", tier: "infinity", duration: 12, pieces: "many", dab: "#5bc0be" },
  { id: "countdown", name: "New drop countdown", sub: "Days to go, then the reveal", tier: "infinity", duration: 10, pieces: "one", dab: "#e3b23c" },
  { id: "seasonal", name: "Seasonal frame", sub: "Snow, leaves, petals or sun around your piece", tier: "infinity", duration: 10, pieces: "one", dab: "#e8743b" },
];

export const PRESET_IDS = PRESETS.map((p) => p.id);
export const FREE_PRESETS = PRESETS.filter((p) => p.tier === "free").map((p) => p.id);
export const isPreset = (v: unknown): v is PresetId => typeof v === "string" && (PRESET_IDS as string[]).includes(v);
export const presetOf = (id: PresetId): PresetDef => PRESETS.find((p) => p.id === id) ?? PRESETS[0];

/** Length of the brand logo outro (Infinity), added to the preset's duration. */
export const OUTRO_SECONDS = 1.5;
export const durationOf = (id: PresetId, withLogo = false) => presetOf(id).duration + (withLogo ? OUTRO_SECONDS : 0);

export type Season = "winter" | "holiday" | "spring" | "summer" | "fall";
export const SEASONS: Record<Season, { label: string; line: string }> = {
  winter: { label: "Winter", line: "Warm walls for winter" },
  holiday: { label: "Holidays", line: "Gift a print this season" },
  spring: { label: "Spring", line: "Fresh for spring" },
  summer: { label: "Summer", line: "Summer on your wall" },
  fall: { label: "Fall", line: "Fall for something new" },
};
export const isSeason = (v: unknown): v is Season => typeof v === "string" && v in SEASONS;
/** The season for a date in New York. */
export function seasonFor(d = new Date()): Season {
  const m = d.getMonth();
  if (m === 11 || (m === 10 && d.getDate() >= 20)) return "holiday";
  if (m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "fall";
}

/** Music: silent by default. The tracks are generated in the browser (components/share/videos/music.ts), so there is nothing licensed to clear. */
export type MusicId = "none" | "pad" | "pulse";
export const MUSIC: Record<MusicId, { label: string; sub: string }> = {
  none: { label: "No sound", sub: "Add trending audio in Instagram or TikTok" },
  pad: { label: "Soft pad", sub: "Calm chords, made here, royalty-free" },
  pulse: { label: "Easy pulse", sub: "A gentle beat, made here, royalty-free" },
};
export const isMusic = (v: unknown): v is MusicId => v === "none" || v === "pad" || v === "pulse";

export type BrandColors = { bg: string; ink: string; accent: string };
export const DEFAULT_BRAND: BrandColors = { bg: "#f2f3ec", ink: "#15161b", accent: "#ffd43b" };
export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
