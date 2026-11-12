// Artist page design (Artist.pageTheme). Shared by the public page, the Studio editor and the save API.
// Pure module: safe on server and client.

export const PAINTS = [
  // Garnet = the site's brand colour (--af-scan, Garnet Rose), and the default for pages that haven't picked one.
  { id: "garnet", name: "Garnet", color: "#8b2a4b", ink: "#ffffff", soft: "#f6e1e6" },
  { id: "ultramarine", name: "Ultramarine", color: "#2b37f0", ink: "#ffffff", soft: "#e6e8ff" },
  { id: "cadmium-red", name: "Cadmium red", color: "#e2442b", ink: "#ffffff", soft: "#fde5df" },
  { id: "cadmium-orange", name: "Cadmium orange", color: "#e8743b", ink: "#15161b", soft: "#fde9dc" },
  { id: "naples-yellow", name: "Naples yellow", color: "#ffd43b", ink: "#15161b", soft: "#fff5cc" },
  { id: "sap-green", name: "Sap green", color: "#4f7a2a", ink: "#ffffff", soft: "#e7efdc" },
  { id: "cerulean", name: "Cerulean", color: "#1f8fb5", ink: "#ffffff", soft: "#dcf0f7" },
  { id: "alizarin", name: "Alizarin crimson", color: "#a8213f", ink: "#ffffff", soft: "#f6dde3" },
  { id: "dioxazine", name: "Dioxazine violet", color: "#5b2c8f", ink: "#ffffff", soft: "#ebe2f5" },
  { id: "paynes-grey", name: "Payne's grey", color: "#3d4654", ink: "#ffffff", soft: "#e3e6ea" },
  { id: "raw-sienna", name: "Raw sienna", color: "#b8763a", ink: "#ffffff", soft: "#f4e6d8" },
] as const;

export type PaintId = (typeof PAINTS)[number]["id"];
export type Paint = (typeof PAINTS)[number];
export type Layout = "grid" | "single" | "salon";

export const LAYOUTS: { id: Layout; name: string; note: string }[] = [
  { id: "grid", name: "Grid", note: "Even rows" },
  { id: "single", name: "Large", note: "One big column" },
  { id: "salon", name: "Salon wall", note: "Mixed sizes" },
];

export type Banner = { kind: "auto" } | { kind: "art"; artworkId: string } | { kind: "color"; paint: PaintId };

export type PageTheme = {
  accent: PaintId;
  banner: Banner;
  layout: Layout;
  pinned: string[];
  showStats: boolean;
};

export const DEFAULT_THEME: PageTheme = { accent: "garnet", banner: { kind: "auto" }, layout: "grid", pinned: [], showStats: true };
export const MAX_PINNED = 3;

const isPaint = (v: unknown): v is PaintId => typeof v === "string" && PAINTS.some((p) => p.id === v);
const ID = /^[a-z0-9]{8,40}$/i;

export function paint(id: PaintId | undefined | null): Paint {
  return PAINTS.find((p) => p.id === id) ?? PAINTS[0];
}

/**
 * Turn anything (stored JSON, a request body, a preview query) into a valid theme.
 * Unknown values fall back to defaults. When `artworkIds` is given, banner and pins must be the artist's own approved work.
 */
export function parseTheme(raw: unknown, artworkIds?: Set<string> | string[]): PageTheme {
  const owned = artworkIds ? (artworkIds instanceof Set ? artworkIds : new Set(artworkIds)) : null;
  const ok = (id: unknown): id is string => typeof id === "string" && ID.test(id) && (!owned || owned.has(id));
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const accent = isPaint(o.accent) ? o.accent : DEFAULT_THEME.accent;
  const layout: Layout = o.layout === "single" || o.layout === "salon" || o.layout === "grid" ? o.layout : DEFAULT_THEME.layout;

  let banner: Banner = { kind: "auto" };
  const b = o.banner && typeof o.banner === "object" ? (o.banner as Record<string, unknown>) : null;
  if (b?.kind === "art" && ok(b.artworkId)) banner = { kind: "art", artworkId: b.artworkId };
  else if (b?.kind === "color" && isPaint(b.paint)) banner = { kind: "color", paint: b.paint };

  const pinned = Array.isArray(o.pinned) ? Array.from(new Set(o.pinned.filter(ok))).slice(0, MAX_PINNED) : [];
  const showStats = typeof o.showStats === "boolean" ? o.showStats : true;

  return { accent, banner, layout, pinned, showStats };
}

/** Strict check for the save API: returns an error message, or null when the body is a valid theme. */
export function themeError(raw: unknown, artworkIds: Set<string>): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "Send a theme object.";
  const o = raw as Record<string, unknown>;
  if (!isPaint(o.accent)) return "Pick an accent color from the palette.";
  if (o.layout !== "grid" && o.layout !== "single" && o.layout !== "salon") return "Pick a layout.";
  const b = o.banner as Record<string, unknown> | undefined;
  if (!b || typeof b !== "object") return "Pick a banner.";
  if (b.kind === "art") {
    if (typeof b.artworkId !== "string" || !artworkIds.has(b.artworkId)) return "Banner must be one of your approved pieces.";
  } else if (b.kind === "color") {
    if (!isPaint(b.paint)) return "Pick a banner color from the palette.";
  } else if (b.kind !== "auto") return "Pick a banner.";
  if (!Array.isArray(o.pinned)) return "Pinned must be a list.";
  if (o.pinned.length > MAX_PINNED) return `Pin up to ${MAX_PINNED} pieces.`;
  if (o.pinned.some((id) => typeof id !== "string" || !artworkIds.has(id))) return "You can only pin your approved pieces.";
  if (typeof o.showStats !== "boolean") return "Show medals must be on or off.";
  return null;
}
