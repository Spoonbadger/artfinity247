// Font pairings for the link page. Loaded only where the link page or its preview renders.
// Bundled in /fonts (see fonts/README.md) so the build never downloads from Google Fonts.
import localFont from "next/font/local";
import type { LinksTheme } from "./model";

const fraunces = localFont({ src: "../../fonts/fraunces-600-800.woff2", weight: "600 800", variable: "--lk-fraunces", display: "swap" });
const caveat = localFont({ src: "../../fonts/caveat-brush-400.woff2", weight: "400", variable: "--lk-caveat", display: "swap" });
const dmSerif = localFont({ src: "../../fonts/dm-serif-display-400.woff2", weight: "400", variable: "--lk-dmserif", display: "swap" });
const dmSans = localFont({ src: "../../fonts/dm-sans-100-1000.woff2", weight: "100 1000", variable: "--lk-dmsans", display: "swap" });

/** Class names that define the font variables; put on the page root. */
export const linkFontVars = [fraunces.variable, caveat.variable, dmSerif.variable, dmSans.variable].join(" ");

type Pair = { display: string; body: string; displayWeight: number; displaySettings?: string; tracking?: string };

export const FONT_PAIRS: Record<LinksTheme["font"], Pair> = {
  gallery: { display: "var(--font-display)", body: "var(--font-body)", displayWeight: 800, displaySettings: "'wdth' 78", tracking: "-0.02em" },
  classic: { display: "var(--lk-fraunces), Georgia, serif", body: "var(--font-body)", displayWeight: 800, tracking: "-0.01em" },
  painted: { display: "var(--lk-caveat), 'Comic Sans MS', cursive", body: "var(--font-body)", displayWeight: 400 },
  editorial: { display: "var(--lk-dmserif), Georgia, serif", body: "var(--lk-dmsans), system-ui, sans-serif", displayWeight: 400, tracking: "-0.01em" },
};
