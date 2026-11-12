import type { CSSProperties } from "react";
import { Libre_Bodoni, Roboto_Mono } from "next/font/google";

/*
 * Palette data and colour maths for the brand colour preview (page.tsx). Each palette overrides the --af-* tokens
 * from app/globals.css inside its own wrapper only. Nothing here changes the live site.
 */

// Palette B only: the original site's faces (main branch app/layout.tsx loaded both).
const bodoni = Libre_Bodoni({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--pv-bodoni",
  display: "swap",
  fallback: ["Didot", "Bodoni MT", "Georgia", "serif"],
});
const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--pv-mono",
  display: "swap",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

/** The site's functional colours, copied from app/globals.css. A palette may override one as a proposed tweak. */
export const SITE = {
  coral: "#ff5a36",
  "coral-text": "#c4321a",
  earned: "#0f7a55",
  "earned-soft": "#e1f2ea",
  sticker: "#ffd43b",
  "field-edge": "#85877c",
} as const;

export type Tokens = {
  ink: string;
  "ink-2": string;
  paper: string;
  wall: string;
  line: string;
  edge: string;
  "edge-strong": string;
  scan: string;
  "scan-soft": string;
  sticker: string;
  /** Optional: text inputs and selects. Falls back to the site's field edge. */
  "field-edge"?: string;
  /** Optional functional tweaks. Fall back to the site's values. */
  "coral-text"?: string;
  earned?: string;
};

export type Swatch = { hex: string; name: string; role: string };

export type Palette = {
  id: string;
  letter: string;
  name: string;
  blurb: string;
  tokens: Tokens;
  /** Headline colour when it isn't the ink (palette B's maroon). */
  head?: string;
  /** Link colour when it isn't the primary. */
  link?: string;
  /** Focus ring colour when it isn't the primary. */
  focus?: string;
  /** Extra preview-only variables: fonts, logo paint. */
  extra?: Record<string, string>;
  className?: string;
  oldLogo?: boolean;
  swatches: Swatch[];
  /** Smaller swatches under the main ones: link, focus, edges, functional tweaks. */
  support?: Swatch[];
  note?: string;
};

export const CURRENT: Palette = {
  id: "current",
  letter: "A",
  name: "Current",
  blurb: "The 2.0 colours exactly as they are on the site today: ink on wall-white, Scan Blue for actions and the logo.",
  tokens: {
    ink: "#15161b",
    "ink-2": "#5a5d6b",
    paper: "#ffffff",
    wall: "#f2f3ec",
    line: "#e1e2da",
    edge: "#d9dad2",
    "edge-strong": "#8a8c81",
    scan: "#2b37f0",
    "scan-soft": "#e6e8ff",
    sticker: "#ffd43b",
  },
  swatches: [
    { hex: "#2b37f0", name: "Scan Blue", role: "Primary buttons, logo, links" },
    { hex: "#15161b", name: "Ink", role: "Text, header button" },
    { hex: "#5a5d6b", name: "Quiet ink", role: "Secondary text" },
    { hex: "#ffd43b", name: "Sticker", role: "Badges" },
    { hex: "#f2f3ec", name: "Wall", role: "Section background" },
    { hex: "#ffffff", name: "Paper", role: "Page background" },
  ],
};

export const ORIGINAL: Palette = {
  id: "original",
  letter: "B",
  name: "Original Artfinity",
  blurb:
    "The first site's pink, rose, maroon and slate, with Libre Bodoni headings and Roboto Mono accents, and the old script logo.",
  tokens: {
    ink: "#1e293b",
    "ink-2": "#475569",
    paper: "#ffffff",
    wall: "#f0e8e8",
    line: "#e1d0d0",
    edge: "#e1d0d0",
    "edge-strong": "#a57272",
    scan: "#b05c5c",
    "scan-soft": "#f8e7e7",
    sticker: "#dd8888",
  },
  head: "#691414",
  extra: {
    "--pv-head-font": "var(--pv-bodoni)",
    "--pv-head-weight": "500",
    "--pv-head-tracking": "-0.01em",
    "--pv-accent-font": "var(--pv-mono)",
    "--pv-accent-case": "uppercase",
    "--pv-body-font": "var(--pv-mono)",
  },
  className: `${bodoni.variable} ${robotoMono.variable}`,
  oldLogo: true,
  swatches: [
    { hex: "#dd8888", name: "Artfinity pink", role: "Logo, badges (decoration only)" },
    { hex: "#e88b8c", name: "Headline pink", role: "Old h1, h2, h4. Shown in swatch only" },
    { hex: "#b05c5c", name: "Rose", role: "Primary buttons (old email buttons)" },
    { hex: "#691414", name: "Maroon", role: "Headlines" },
    { hex: "#1e293b", name: "Slate", role: "Text, header button" },
    { hex: "#475569", name: "Quiet slate", role: "Secondary text" },
    { hex: "#f0e8e8", name: "Blush", role: "Section background" },
  ],
  note:
    "The old headline pink (#e88b8c) is 2.5:1 on white and the old pink button had near-white text at about 2.6:1, both below AA. Here the headlines use the old maroon and the primary button uses the old rose from the emails, so the pink stays in the logo and badges.",
};

export const PLASTER_ROSE: Palette = {
  id: "plaster-rose",
  letter: "C",
  name: "Plaster Rose",
  blurb: "A new pink: a muted, warm rose with a deep burgundy ink, on a soft plaster neutral.",
  tokens: {
    ink: "#3a1b24",
    "ink-2": "#6e5a5f",
    paper: "#fbf8f5",
    wall: "#f3ece6",
    line: "#e6dbd3",
    edge: "#e6dbd3",
    "edge-strong": "#8e7b7a",
    scan: "#9b4655",
    "scan-soft": "#f3dfe0",
    sticker: "#ecc5c0",
    "field-edge": "#8e7b7a",
  },
  swatches: [
    { hex: "#9b4655", name: "Rose", role: "Primary buttons, logo, links" },
    { hex: "#3a1b24", name: "Burgundy ink", role: "Text, header button" },
    { hex: "#6e5a5f", name: "Quiet ink", role: "Secondary text" },
    { hex: "#ecc5c0", name: "Blush", role: "Badges" },
    { hex: "#f3ece6", name: "Plaster", role: "Section background" },
    { hex: "#fbf8f5", name: "Paper", role: "Page background" },
  ],
  support: [
    { hex: "#8e7b7a", name: "Control edge", role: "Secondary buttons, fields" },
    { hex: "#e6dbd3", name: "Box edge", role: "Cards, dividers" },
  ],
  note: "The original, for reference. Its rose sits close to the error red, so a Buy button and a Delete button look alike. The four variations move them apart.",
};

export const GARNET_ROSE: Palette = {
  id: "c1-garnet-rose",
  letter: "C1",
  name: "Garnet Rose",
  blurb: "Deeper, richer rose on warm ivory. Feels more like a high-end gallery.",
  tokens: {
    ink: "#2e1219",
    "ink-2": "#694c54",
    paper: "#fdfaf7",
    wall: "#f6ede9",
    line: "#ecdcd8",
    edge: "#ecdcd8",
    "edge-strong": "#957a80",
    scan: "#8b2a4b",
    "scan-soft": "#f6e1e6",
    sticker: "#f0c3cc",
    "field-edge": "#8e737a",
  },
  swatches: [
    { hex: "#8b2a4b", name: "Garnet", role: "Primary buttons, logo, links, focus" },
    { hex: "#2e1219", name: "Black cherry", role: "Text, header button" },
    { hex: "#694c54", name: "Quiet ink", role: "Secondary text" },
    { hex: "#f0c3cc", name: "Petal", role: "Badges, brush strokes" },
    { hex: "#f6ede9", name: "Blush plaster", role: "Section background" },
    { hex: "#fdfaf7", name: "Ivory", role: "Page background" },
  ],
  support: [
    { hex: "#957a80", name: "Control edge", role: "Secondary buttons" },
    { hex: "#8e737a", name: "Field edge", role: "Text inputs, selects" },
    { hex: "#ecdcd8", name: "Box edge", role: "Cards, dividers" },
  ],
  note: "No functional tweaks. The garnet leans cool and dark, so it stays clear of the warmer, brighter error red.",
};

export const DUSTY_MAUVE: Palette = {
  id: "c2-dusty-mauve",
  letter: "C2",
  name: "Dusty Mauve",
  blurb: "A softer, grayer rose on greige. Quiet like a museum wall, so the art does the talking.",
  tokens: {
    ink: "#2f2729",
    "ink-2": "#665d5f",
    paper: "#faf8f5",
    wall: "#f0ece7",
    line: "#e3ddd8",
    edge: "#e3ddd8",
    "edge-strong": "#878080",
    scan: "#87566a",
    "scan-soft": "#efe3e7",
    sticker: "#e2d0d2",
    "field-edge": "#837b7c",
  },
  link: "#7b4a5e",
  focus: "#7b4a5e",
  swatches: [
    { hex: "#87566a", name: "Mauve", role: "Primary buttons, logo" },
    { hex: "#2f2729", name: "Warm charcoal", role: "Text, header button" },
    { hex: "#665d5f", name: "Quiet ink", role: "Secondary text" },
    { hex: "#e2d0d2", name: "Dusty pink", role: "Badges, brush strokes" },
    { hex: "#f0ece7", name: "Greige", role: "Section background" },
    { hex: "#faf8f5", name: "Bone", role: "Page background" },
  ],
  support: [
    { hex: "#7b4a5e", name: "Deep mauve", role: "Links, focus ring" },
    { hex: "#878080", name: "Control edge", role: "Secondary buttons" },
    { hex: "#837b7c", name: "Field edge", role: "Text inputs, selects" },
    { hex: "#e3ddd8", name: "Box edge", role: "Cards, dividers" },
  ],
  note: "No functional tweaks. Mauve is far from the error red. Links use a deeper mauve so they read as links on greige.",
};

export const ROSE_SAGE: Palette = {
  id: "c3-rose-sage",
  letter: "C3",
  name: "Rose and Sage",
  blurb: "Rose paired with a soft sage for badges and paint. Two colours that suit each other, neither loud.",
  tokens: {
    ink: "#33201f",
    "ink-2": "#65595a",
    paper: "#fbf8f4",
    wall: "#f2ede6",
    line: "#e5ddd4",
    edge: "#e5ddd4",
    "edge-strong": "#8c7f7c",
    scan: "#963f58",
    "scan-soft": "#f3e0e4",
    sticker: "#cdd5bf",
    "field-edge": "#877a77",
  },
  swatches: [
    { hex: "#963f58", name: "Rose", role: "Primary buttons, logo, links, focus" },
    { hex: "#33201f", name: "Cocoa ink", role: "Text, header button" },
    { hex: "#65595a", name: "Quiet ink", role: "Secondary text" },
    { hex: "#cdd5bf", name: "Sage", role: "Badges, brush strokes" },
    { hex: "#f2ede6", name: "Plaster", role: "Section background" },
    { hex: "#fbf8f4", name: "Paper", role: "Page background" },
  ],
  support: [
    { hex: "#8c7f7c", name: "Control edge", role: "Secondary buttons" },
    { hex: "#877a77", name: "Field edge", role: "Text inputs, selects" },
    { hex: "#e5ddd4", name: "Box edge", role: "Cards, dividers" },
  ],
  note: "Rose moved a little cooler than C to sit further from the error red. Sage stays pale and gray, so money green is still the only real green. Success messages keep money green.",
};

export const OXBLOOD_EDITORIAL: Palette = {
  id: "c4-oxblood-editorial",
  letter: "C4",
  name: "Oxblood Editorial",
  blurb: "Rose with a near-black plum ink on warm sand. Sharper contrast, like a print magazine.",
  tokens: {
    ink: "#2a0f1e",
    "ink-2": "#5d4850",
    paper: "#fbf7f1",
    wall: "#f2e9dd",
    line: "#e6d9c8",
    edge: "#e6d9c8",
    "edge-strong": "#8b766f",
    scan: "#9e3a55",
    "scan-soft": "#f5e0e5",
    sticker: "#dcb88f",
    "field-edge": "#86716a",
    "coral-text": "#b5400c",
    earned: "#0d7050",
  },
  focus: "#2a0f1e",
  swatches: [
    { hex: "#9e3a55", name: "Rose", role: "Primary buttons, logo, links" },
    { hex: "#2a0f1e", name: "Plum ink", role: "Text, header button, focus ring" },
    { hex: "#5d4850", name: "Quiet ink", role: "Secondary text" },
    { hex: "#dcb88f", name: "Camel", role: "Badges, brush strokes" },
    { hex: "#f2e9dd", name: "Sand", role: "Section background" },
    { hex: "#fbf7f1", name: "Paper", role: "Page background" },
  ],
  support: [
    { hex: "#8b766f", name: "Control edge", role: "Secondary buttons" },
    { hex: "#86716a", name: "Field edge", role: "Text inputs, selects" },
    { hex: "#e6d9c8", name: "Box edge", role: "Cards, dividers" },
    { hex: "#b5400c", name: "Error red, tweaked", role: "Was #c4321a. A step toward orange" },
    { hex: "#0d7050", name: "Earned, tweaked", role: "Was #0f7a55. A step darker for sand" },
  ],
  note: "Two small tweaks if chosen: the error red moves a step toward orange so it never looks like the rose, and money green goes a step darker so it passes on sand.",
};

export const MUSEUM_GREEN: Palette = {
  id: "museum-green",
  letter: "D",
  name: "Museum Green",
  blurb:
    "My pick: deep green is a classic gallery wall colour. It feels calm and serious, flatters paintings of almost any palette, and is nowhere near Facebook blue.",
  tokens: {
    ink: "#1b2420",
    "ink-2": "#55605a",
    paper: "#fbf9f3",
    wall: "#eeeee4",
    line: "#dfdfd2",
    edge: "#dfdfd2",
    "edge-strong": "#7f8478",
    scan: "#1f4d3a",
    "scan-soft": "#e1ebe4",
    sticker: "#c8a15a",
  },
  swatches: [
    { hex: "#1f4d3a", name: "Museum green", role: "Primary buttons, logo, links" },
    { hex: "#1b2420", name: "Ink", role: "Text, header button" },
    { hex: "#55605a", name: "Quiet ink", role: "Secondary text" },
    { hex: "#c8a15a", name: "Brass", role: "Badges" },
    { hex: "#eeeee4", name: "Linen", role: "Section background" },
    { hex: "#fbf9f3", name: "Ivory", role: "Page background" },
  ],
  note: "If chosen, the money green used for earnings (#0f7a55) would want a second look so the two greens stay distinct.",
};

/** Option C and its four variations, shown first. */
export const C_FAMILY = [PLASTER_ROSE, GARNET_ROSE, DUSTY_MAUVE, ROSE_SAGE, OXBLOOD_EDITORIAL];
/** The other options, shown below, unchanged. */
export const EARLIER = [CURRENT, ORIGINAL, MUSEUM_GREEN];

// WCAG 2 contrast ratio, worked out here so the numbers on the page always match the colours.
const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16) / 255;
const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => linear(channel(hex, i)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

// OKLCH hue angle, to see how far a rose sits from the error red on the colour wheel.
function hue(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => linear(channel(hex, i)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
}
export function hueGap(a: string, b: string) {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

/** The colours a palette actually uses, with the site's values filled in where it has none of its own. */
export function resolved(p: Palette) {
  const t = p.tokens;
  return {
    ...t,
    link: p.link ?? t.scan,
    focus: p.focus ?? t.scan,
    "field-edge": t["field-edge"] ?? SITE["field-edge"],
    "coral-text": t["coral-text"] ?? SITE["coral-text"],
    earned: t.earned ?? SITE.earned,
  };
}

export function paletteStyle(p: Palette): CSSProperties {
  const style: Record<string, string> = { ...p.extra };
  for (const [key, hex] of Object.entries(p.tokens)) {
    if (!hex) continue;
    style[`--af-${key}`] = hex;
    style[`--af-${key}-rgb`] = rgb(hex);
  }
  if (p.head) style["--pv-head-color"] = p.head;
  if (p.link) style["--pv-link"] = p.link;
  if (p.focus) style["--pv-focus"] = p.focus;
  return style as CSSProperties;
}

/** The yellow sticker, set back on a small area inside a palette that uses another badge colour. */
export const YELLOW_STICKER = { "--af-sticker": SITE.sticker, "--af-sticker-rgb": rgb(SITE.sticker) } as CSSProperties;

export type Check = { label: string; value: number; need: number; unit?: "ratio" | "deg" };

export function checks(p: Palette): Check[] {
  const t = p.tokens;
  return [
    { label: "Primary button text (white on primary)", value: contrast("#ffffff", t.scan), need: 4.5 },
    { label: "Header button text (white on ink)", value: contrast("#ffffff", t.ink), need: 4.5 },
    { label: "Headline on section background", value: contrast(p.head ?? t.ink, t.wall), need: 3 },
    { label: "Body text on page", value: contrast(t.ink, t.paper), need: 4.5 },
    { label: "Secondary text on section background", value: contrast(t["ink-2"], t.wall), need: 4.5 },
    { label: "Badge text on badge colour", value: contrast(t.ink, t.sticker), need: 4.5 },
    { label: "Primary colour as link text on page", value: contrast(t.scan, t.paper), need: 4.5 },
    { label: "Secondary button edge on page", value: contrast(t["edge-strong"], t.paper), need: 3 },
  ];
}

/** The fuller set for the C palettes: every text and edge pair on both backgrounds, plus the site's functional colours. */
export function fullChecks(p: Palette): Check[] {
  const c = resolved(p);
  return [
    { label: "Primary button text (white on primary)", value: contrast("#ffffff", c.scan), need: 4.5 },
    { label: "Header button text (white on ink)", value: contrast("#ffffff", c.ink), need: 4.5 },
    { label: "Body text on page", value: contrast(c.ink, c.paper), need: 4.5 },
    { label: "Body text on section background", value: contrast(c.ink, c.wall), need: 4.5 },
    { label: "Secondary text on page", value: contrast(c["ink-2"], c.paper), need: 4.5 },
    { label: "Secondary text on section background", value: contrast(c["ink-2"], c.wall), need: 4.5 },
    { label: "Link on page", value: contrast(c.link, c.paper), need: 4.5 },
    { label: "Link on section background", value: contrast(c.link, c.wall), need: 4.5 },
    { label: "Badge text on badge colour", value: contrast(c.ink, c.sticker), need: 4.5 },
    { label: "Secondary button edge on page", value: contrast(c["edge-strong"], c.paper), need: 3 },
    { label: "Secondary button edge on section background", value: contrast(c["edge-strong"], c.wall), need: 3 },
    { label: "Field edge on page", value: contrast(c["field-edge"], c.paper), need: 3 },
    { label: "Focus ring on page", value: contrast(c.focus, c.paper), need: 3 },
    { label: "Error text on page", value: contrast(c["coral-text"], c.paper), need: 4.5 },
    { label: "Error text on section background", value: contrast(c["coral-text"], c.wall), need: 4.5 },
    { label: "White on the Delete button", value: contrast("#ffffff", c["coral-text"]), need: 4.5 },
    { label: "Earnings text on page", value: contrast(c.earned, c.paper), need: 4.5 },
    { label: "Earnings text on section background", value: contrast(c.earned, c.wall), need: 4.5 },
    { label: "Earnings text on its green chip", value: contrast(c.earned, SITE["earned-soft"]), need: 4.5 },
    { label: "Primary and error red, hue apart", value: hueGap(c.scan, c["coral-text"]), need: 25, unit: "deg" },
  ];
}
