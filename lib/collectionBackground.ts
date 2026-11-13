// The background of a public collection page, chosen by the artist in Studio.
// Stored as JSON on Collection.background. Anything missing or unknown falls back to the gallery wall.
// Shared by the Studio editor (client), the PATCH route and the public page, so keep it free of server imports.

/** A curated palette. `tone` says whether text on it is dark (light background) or light (dark background). */
export const BG_COLORS = [
  { id: "chalk", name: "Chalk", hex: "#f6f4ef", tone: "light" },
  { id: "linen", name: "Linen", hex: "#ebe2d3", tone: "light" },
  { id: "blush", name: "Blush", hex: "#f0ddd6", tone: "light" },
  { id: "sage", name: "Sage", hex: "#d9e0d3", tone: "light" },
  { id: "sky", name: "Sky", hex: "#d7e1ea", tone: "light" },
  { id: "clay", name: "Clay", hex: "#8f4f3a", tone: "dark" },
  { id: "forest", name: "Forest", hex: "#2d3b31", tone: "dark" },
  { id: "navy", name: "Navy", hex: "#1e2840", tone: "dark" },
  { id: "ink", name: "Ink", hex: "#16171c", tone: "dark" },
] as const;

export type BgColorId = (typeof BG_COLORS)[number]["id"];
export type Tone = "light" | "dark";

export const BLUR_MAX = 40; // px
export const TINT_MIN = 30; // % — the hang and title have to read over the painting
export const TINT_MAX = 90;
/** Sensitive paintings are always blurred at least this much for viewers who haven't opted in. */
export const SENSITIVE_BLUR = 32;

export type CollectionBackground =
  | { kind: "wall" }
  | { kind: "color"; color: BgColorId }
  | { kind: "painting"; artworkId: string; blur: number; tint: BgColorId; tintOpacity: number };

export const DEFAULT_BACKGROUND: CollectionBackground = { kind: "wall" };
export const DEFAULT_PAINTING = { blur: 16, tint: "chalk" as BgColorId, tintOpacity: 55 };

export const colorById = (id: string | null | undefined) => BG_COLORS.find((c) => c.id === id);
const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
};

/** Any stored or posted value → a valid background (the wall when it isn't one). */
export function parseBackground(raw: unknown): CollectionBackground {
  if (!raw || typeof raw !== "object") return DEFAULT_BACKGROUND;
  const r = raw as Record<string, unknown>;
  if (r.kind === "color" && colorById(String(r.color))) return { kind: "color", color: String(r.color) as BgColorId };
  if (r.kind === "painting" && typeof r.artworkId === "string" && r.artworkId) {
    return {
      kind: "painting",
      artworkId: r.artworkId,
      blur: clamp(r.blur, 0, BLUR_MAX, DEFAULT_PAINTING.blur),
      tint: colorById(String(r.tint)) ? (String(r.tint) as BgColorId) : DEFAULT_PAINTING.tint,
      tintOpacity: clamp(r.tintOpacity, TINT_MIN, TINT_MAX, DEFAULT_PAINTING.tintOpacity),
    };
  }
  return DEFAULT_BACKGROUND;
}

/** Light background → dark text, and the other way round. A painting takes the tone of its tint. */
export function backgroundTone(bg: CollectionBackground): Tone {
  if (bg.kind === "color") return colorById(bg.color)?.tone ?? "light";
  if (bg.kind === "painting") return colorById(bg.tint)?.tone ?? "light";
  return "light";
}

/** Short label for the Studio "Background" button. */
export function backgroundLabel(bg: CollectionBackground) {
  if (bg.kind === "color") return colorById(bg.color)?.name ?? "Color";
  if (bg.kind === "painting") return "A painting";
  return "Gallery wall";
}

/** The gallery wall: the warm-gray gradient collection pages have always had. */
export const WALL_GRADIENT = "radial-gradient(ellipse at 50% 0%, #f7f5f0 0%, #ebe7df 55%, #e4dfd5 100%)";
