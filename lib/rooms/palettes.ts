// Curated interior palettes. Every wall color comes with fabrics and accents that already work with it.

export type Palette = {
  key: string;
  wall: string; // main wall paint
  trim: string; // baseboards, window frames
  accent: string; // cushions, a vase, a chair
  fabrics: string[]; // upholstery that sits well on this wall
  dark: boolean; // a dark wall (lighter trim, lamps read stronger)
};

export const PALETTES: Palette[] = [
  { key: "linen", wall: "#ece6dc", trim: "#f6f3ee", accent: "#8e9b7c", fabrics: ["#d9cfbf", "#b9ae9c", "#8e9b7c", "#6f6a62"], dark: false },
  { key: "greige", wall: "#d8cfc2", trim: "#f2eee8", accent: "#b8673f", fabrics: ["#efe8dc", "#c4a988", "#7b6f62", "#b8673f"], dark: false },
  { key: "sage", wall: "#adb69f", trim: "#f1efe6", accent: "#c08b4e", fabrics: ["#eee7da", "#d6c7ad", "#8a6a4c", "#e2d2b4"], dark: false },
  { key: "navy", wall: "#33404f", trim: "#e9e6df", accent: "#c9893f", fabrics: ["#8a5a36", "#e6dccb", "#b98b5a", "#c9c2b4"], dark: true },
  { key: "clay", wall: "#c99476", trim: "#f3ece3", accent: "#4f5d4a", fabrics: ["#efe6d6", "#e3d3bb", "#6c5847", "#4f5d4a"], dark: false },
  { key: "blush", wall: "#e5cbc1", trim: "#f7f1ec", accent: "#6f7650", fabrics: ["#f2ebe2", "#9a7f6e", "#6f7650", "#c7a597"], dark: false },
  { key: "charcoal", wall: "#3e3d3b", trim: "#e6e3dd", accent: "#b45a35", fabrics: ["#b45a35", "#d9d1c4", "#8f8678", "#6b4a33"], dark: true },
  { key: "mist", wall: "#cbd4d6", trim: "#f4f5f3", accent: "#c79a3a", fabrics: ["#f1ede6", "#7e8b8f", "#c79a3a", "#5b6670"], dark: false },
  { key: "olive", wall: "#7e7b5a", trim: "#ece7da", accent: "#d8c39a", fabrics: ["#efe8da", "#d8c39a", "#8f5b3e", "#c9bfae"], dark: true },
  { key: "sand", wall: "#e3cfa8", trim: "#f6f0e2", accent: "#3f5a4c", fabrics: ["#f3ecdf", "#3f5a4c", "#a6784f", "#d8c7a8"], dark: false },
  { key: "chalk", wall: "#f3f1ec", trim: "#fbfaf7", accent: "#22252b", fabrics: ["#e9e4da", "#bdb6aa", "#4a4d52", "#d9cdb8"], dark: false },
  { key: "forest", wall: "#3f5246", trim: "#ebe6da", accent: "#d39b45", fabrics: ["#d39b45", "#e9e1d0", "#a2633f", "#c8bea9"], dark: true },
  { key: "plum", wall: "#5e4652", trim: "#eee6e2", accent: "#e0b7a5", fabrics: ["#e0b7a5", "#e8e0d5", "#8f7a6c", "#b98f7a"], dark: true },
  { key: "stone", wall: "#cdc6b9", trim: "#f3f0ea", accent: "#5c6f86", fabrics: ["#ece6db", "#5c6f86", "#9d8f7d", "#dcd2c2"], dark: false },
  { key: "butter", wall: "#efe3bd", trim: "#f9f5e9", accent: "#3c6b6a", fabrics: ["#f4efe2", "#3c6b6a", "#b7926a", "#ddd0b3"], dark: false },
  { key: "mushroom", wall: "#b7aa9a", trim: "#efebe4", accent: "#a14f2f", fabrics: ["#ece5d9", "#a14f2f", "#6f655a", "#d8cbb7"], dark: false },
];

/** Furniture woods. */
export const WOODS = {
  oak: "#c7a27a",
  honey: "#b07c4c",
  walnut: "#6e4c35",
  ebony: "#2d2926",
  ash: "#ddd0bc",
} as const;
export type WoodKey = keyof typeof WOODS;

/** Plaster, lacquer and metal finishes for small things. */
export const METALS = ["#b8955a", "#23252a", "#9a9a96", "#b9714a"] as const; // brass, black, steel, copper
export const CERAMICS = ["#efe9df", "#d8c7ad", "#2b2d31", "#b8673f", "#7d8c74", "#c9b8a4", "#e7dccb", "#5c6f86"] as const;
export const BOOKS = ["#a14f2f", "#3f5a4c", "#d8c39a", "#2f3a4a", "#e9e1d0", "#8a6a4c", "#c79a3a", "#6f7650", "#b98f7a", "#5c6f86", "#ece6db", "#22252b"] as const;

export const BRICKS = [
  { key: "red", base: "#a65a43", vary: ["#9b5039", "#b0644b", "#8f4a36", "#a8604a", "#b56d52"], mortar: "#d2c6b6" },
  { key: "whitewash", base: "#ebe6de", vary: ["#e6e0d6", "#f0ebe4", "#ded7cc", "#e9e3d9", "#f3efe9"], mortar: "#d8d1c5" },
  { key: "brown", base: "#8a6a55", vary: ["#7f604c", "#93725c", "#76584a", "#9a7a62", "#86664f"], mortar: "#c9bba8" },
  { key: "ink", base: "#3a3a3c", vary: ["#353537", "#414143", "#2f2f31", "#3d3c3e", "#454446"], mortar: "#5b5a58" },
] as const;

/** Wood floors and plank colors. */
export const FLOOR_WOODS = [
  { key: "pale oak", base: "#d9c1a0", line: "#b99c78" },
  { key: "honey oak", base: "#c39565", line: "#a1754a" },
  { key: "walnut", base: "#7b5841", line: "#5e412f" },
  { key: "whitewashed", base: "#e2d7c6", line: "#c9baa4" },
] as const;

export const TILES = [
  { key: "terracotta", a: "#c27753", b: "#b56b49", grout: "#d8c3ad", checker: false },
  { key: "checker", a: "#efebe3", b: "#2b2c30", grout: "#cfc9bf", checker: true },
  { key: "cream", a: "#ebe5d9", b: "#e3dccd", grout: "#cbc2b2", checker: false },
  { key: "sage checker", a: "#ece6d8", b: "#93a088", grout: "#d3cbbb", checker: true },
] as const;

export const CONCRETES = ["#c8c4bd", "#b3aea6", "#d6d0c6"] as const;
export const CARPETS = ["#d9cfbf", "#b9b2a6", "#a6ab95", "#c8b8a4"] as const;

// ---- color math ----
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Blend a toward b by t (0..1). */
export function mix(a: string, b: string, t: number) {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
/** Negative darkens, positive lightens. */
export const shade = (hex: string, amt: number) => (amt < 0 ? mix(hex, "#1a1714", -amt) : mix(hex, "#ffffff", amt));
/** Perceived lightness 0..1. */
export function lum(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}
