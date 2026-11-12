import type { CSSProperties, ReactNode } from "react";
import { basePrices } from "@/lib/artwork_price";
import type { Metadata } from "next";
import Image from "next/image";
import { Libre_Bodoni, Roboto_Mono } from "next/font/google";
import { Menu, ShoppingBag } from "lucide-react";
import Logo from "@/components/af/Logo";

/*
 * Brand colour preview, for choosing a new brand colour. Not linked from anywhere, not in the sitemap, noindex.
 * Each palette is a wrapper that overrides the --af-* tokens from app/globals.css (hex and the -rgb channels the
 * Tailwind colours read), so the sample below uses the site's own classes: .btn, .btn-blue, .btn-ghost, .t-hero,
 * .sticker-badge, bg-wall, text-ink-2 and so on. Nothing here changes the live site.
 */

export const metadata: Metadata = {
  title: "Brand colour preview",
  robots: { index: false, follow: false },
};

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

type Tokens = {
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
};

type Palette = {
  id: string;
  letter: string;
  name: string;
  blurb: string;
  tokens: Tokens;
  /** Headline colour when it isn't the ink (palette B's maroon). */
  head?: string;
  /** Extra preview-only variables: fonts, logo paint. */
  extra?: Record<string, string>;
  className?: string;
  oldLogo?: boolean;
  swatches: { hex: string; name: string; role: string }[];
  note?: string;
};

const PALETTES: Palette[] = [
  {
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
  },
  {
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
  },
  {
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
    },
    swatches: [
      { hex: "#9b4655", name: "Rose", role: "Primary buttons, logo, links" },
      { hex: "#3a1b24", name: "Burgundy ink", role: "Text, header button" },
      { hex: "#6e5a5f", name: "Quiet ink", role: "Secondary text" },
      { hex: "#ecc5c0", name: "Blush", role: "Badges" },
      { hex: "#f3ece6", name: "Plaster", role: "Section background" },
      { hex: "#fbf8f5", name: "Paper", role: "Page background" },
    ],
  },
  {
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
  },
];

// WCAG 2 contrast ratio, worked out here so the numbers on the page always match the colours.
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(" ");

function paletteStyle(p: Palette): CSSProperties {
  const style: Record<string, string> = { ...p.extra };
  for (const [key, hex] of Object.entries(p.tokens)) {
    style[`--af-${key}`] = hex;
    style[`--af-${key}-rgb`] = rgb(hex);
  }
  if (p.head) style["--pv-head-color"] = p.head;
  return style as CSSProperties;
}

function checks(p: Palette) {
  const t = p.tokens;
  return [
    { label: "Primary button text (white on primary)", ratio: contrast("#ffffff", t.scan), need: 4.5, key: true },
    { label: "Header button text (white on ink)", ratio: contrast("#ffffff", t.ink), need: 4.5 },
    { label: "Headline on section background", ratio: contrast(p.head ?? t.ink, t.wall), need: 3 },
    { label: "Body text on page", ratio: contrast(t.ink, t.paper), need: 4.5 },
    { label: "Secondary text on section background", ratio: contrast(t["ink-2"], t.wall), need: 4.5 },
    { label: "Badge text on badge colour", ratio: contrast(t.ink, t.sticker), need: 4.5 },
    { label: "Primary colour as link text on page", ratio: contrast(t.scan, t.paper), need: 4.5 },
    { label: "Secondary button edge on page", ratio: contrast(t["edge-strong"], t.paper), need: 3 },
  ];
}

// Preview-only font hooks: palette B swaps in Bodoni and Roboto Mono, the others keep the site's own faces.
const HEAD =
  "[font-family:var(--pv-head-font,var(--font-display))] [font-weight:var(--pv-head-weight,800)] [letter-spacing:var(--pv-head-tracking,-0.02em)] text-[color:var(--pv-head-color,var(--af-ink))]";
const ACCENT = "[font-family:var(--pv-accent-font,var(--font-body))] [text-transform:var(--pv-accent-case,none)]";
const BODY = "[font-family:var(--pv-body-font,var(--font-body))]";
const TITLE = "[font-family:var(--pv-head-font,var(--font-body))]";

function Sample({ p }: { p: Palette }) {
  // Uppercase mono labels (palette B) read large; set them a touch smaller and spaced.
  const label = (s: string) => (p.extra?.["--pv-accent-case"] === "uppercase" ? "text-[12.5px] tracking-[0.06em]" : s);
  return (
    <div className="overflow-hidden rounded-2xl border border-edge bg-paper text-ink shadow-[0_12px_32px_-18px_rgba(21,22,27,.35)]">
      {/* Top nav: SiteHeader's markup, simplified */}
      <div className="border-b border-line bg-paper">
        <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
          {p.oldLogo ? (
            <Image src="/assets/images/logo.png" alt="Artfinity" width={720} height={200} className="h-8 w-auto sm:h-9" />
          ) : (
            <Logo href={null} paint="var(--af-scan)" />
          )}
          <nav aria-label={`Sample navigation, palette ${p.letter}`} className={`ml-auto hidden items-center gap-6 font-medium md:flex ${ACCENT} ${label("text-[15px]")}`}>
            <span className="text-scan">Browse art</span>
            <span className="text-ink">Artists</span>
            <span className="text-ink">How it works</span>
            <span className="text-ink">Log in</span>
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <span className="grid h-11 w-11 place-items-center rounded-full text-ink" aria-hidden="true">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <button type="button" className={`btn btn-sm ${ACCENT} ${label("")}`}>Start selling</button>
            <span className="grid h-11 w-9 place-items-center text-ink md:hidden" aria-hidden="true">
              <Menu className="h-5 w-5" />
            </span>
          </div>
        </div>
      </div>

      {/* Hero, with an artwork card beside it on wider screens */}
      <div className="grid gap-8 bg-wall px-4 py-10 sm:px-6 md:grid-cols-[1.35fr_1fr] md:items-center md:gap-10 md:py-14">
        <div className="grid content-start gap-4">
          <p className={`eyebrow ${ACCENT}`}>Sample hero</p>
          <h3 className={`t-hero ${HEAD}`}>Find a painting you love. Take home a print.</h3>
          <p className={`max-w-[44ch] text-[17px] text-ink-2 ${BODY}`}>Prints of work by independent artists, ordered from the painting itself or from here.</p>
          <div>
            <button type="button" className={`btn btn-blue btn-lg ${ACCENT} ${label("")}`}>Browse art</button>
          </div>
        </div>

        {/* Artwork card: ArtCard's markup with a seeded artwork */}
        <article className="grid w-full max-w-[300px] content-start gap-2.5 justify-self-center md:justify-self-end">
          <div className="relative block aspect-[4/5] overflow-hidden rounded-md bg-paper">
            <div className="h-full w-full p-[10%]">
              <Image
                src="/seed/art-07.jpg"
                alt="Fort Tryon Dusk by Maya Okafor"
                width={1200}
                height={1500}
                sizes="300px"
                className="h-full w-full bg-white object-contain shadow-[0_1px_0_rgba(21,22,27,.08),0_12px_24px_-6px_rgba(21,22,27,.35)]"
              />
            </div>
            <span className={`sticker-badge absolute left-2 top-2 ${ACCENT} ${label("")}`}>Sample</span>
          </div>
          <div className="grid min-w-0 gap-0.5 px-0.5">
            <span className={`truncate text-[15px] font-semibold leading-snug text-ink ${TITLE}`}>Fort Tryon Dusk</span>
            <div className="flex items-baseline justify-between gap-2 text-[13.5px]">
              <span className={`truncate text-ink-2 ${BODY}`}>Maya Okafor</span>
              <span className={`num shrink-0 text-ink-2 ${ACCENT} ${label("")}`}>
                from <b className="font-semibold text-ink">${(basePrices.small / 100).toFixed(2)}</b>
              </span>
            </div>
          </div>
        </article>
      </div>

      {/* Primary and secondary buttons */}
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-paper px-4 py-6 sm:px-6">
        <button type="button" className={`btn btn-blue ${ACCENT} ${label("")}`}>Buy a print</button>
        <button type="button" className={`btn btn-ghost ${ACCENT} ${label("")}`}>Save for later</button>
        <a href={`#${p.id}`} className={`text-[15px] font-semibold text-scan underline underline-offset-2 ${BODY}`}>A text link</a>
      </div>

      {/* Footer strip: SiteFooter's colours */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-wall px-4 py-4 text-[13px] text-ink-2 sm:px-6 ${ACCENT}`}>
        <span className="font-semibold text-ink">Artfinity</span>
        <span>About</span>
        <span>Help</span>
        <span>Terms</span>
        <span>Privacy</span>
      </div>
    </div>
  );
}

function Swatches({ p }: { p: Palette }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7" aria-label={`Palette ${p.letter} colours`}>
      {p.swatches.map((s) => (
        <li key={s.hex + s.name} className="grid content-start gap-1.5">
          <span className="block h-14 rounded-xl border border-black/10" style={{ background: s.hex }} aria-hidden="true" />
          <span className="text-[14px] font-semibold leading-tight text-ink">{s.name}</span>
          <code className="text-[13px] text-ink">{s.hex}</code>
          <span className="text-[12.5px] leading-snug text-ink-2">{s.role}</span>
        </li>
      ))}
    </ul>
  );
}

function Checks({ p }: { p: Palette }) {
  return (
    <details className="rounded-xl border border-edge bg-white px-4 py-3 text-[14px]">
      <summary className="cursor-pointer font-semibold text-ink">
        Contrast: primary button text {contrast("#ffffff", p.tokens.scan).toFixed(2)}:1
      </summary>
      <ul className="mt-2 grid gap-1">
        {checks(p).map((c) => (
          <li key={c.label} className="flex flex-wrap justify-between gap-x-4 border-t border-line pt-1 text-ink-2">
            <span>{c.label}</span>
            <span className="num font-semibold text-ink">
              {c.ratio.toFixed(2)}:1 {c.ratio >= c.need ? `passes (needs ${c.need})` : `below ${c.need}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Section({ p, children }: { p: Palette; children: ReactNode }) {
  return (
    <section id={p.id} aria-labelledby={`${p.id}-title`} className="grid scroll-mt-6 gap-5 border-t border-line pt-10">
      <div className="grid gap-2">
        <p className="eyebrow">Palette {p.letter}</p>
        <h2 id={`${p.id}-title`} className="t-section">
          {p.letter}. {p.name}
        </h2>
        <p className="max-w-[70ch] text-[16px] text-ink-2">{p.blurb}</p>
      </div>
      {children}
    </section>
  );
}

export default function BrandPreviewPage() {
  return (
    <main id="main" tabIndex={-1} className="min-h-screen overflow-x-hidden bg-wall">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-10 sm:px-6 md:py-14">
        <header className="grid gap-3">
          <p className="eyebrow">Internal preview</p>
          <h1 className="t-page">Brand colour preview</h1>
          <p className="max-w-[64ch] text-[17px] text-ink-2">
            The same sample in four palettes, so you can compare them side by side. Nothing here changes the live site.
          </p>
          <nav aria-label="Palettes" className="flex flex-wrap gap-2 pt-1">
            {PALETTES.map((p) => (
              <a key={p.id} href={`#${p.id}`} className="btn btn-ghost btn-sm bg-white">
                {p.letter}. {p.name}
              </a>
            ))}
          </nav>
        </header>

        {PALETTES.map((p) => (
          <Section key={p.id} p={p}>
            <div className={p.className} style={paletteStyle(p)}>
              <Sample p={p} />
            </div>
            <Swatches p={p} />
            {p.note && <p className="max-w-[80ch] text-[14px] text-ink-2">{p.note}</p>}
            <Checks p={p} />
          </Section>
        ))}

        <p className="border-t border-line pt-6 text-[13.5px] text-ink-2">
          The artwork is from the seed data. The &ldquo;from&rdquo; price is the real smallest print price.
        </p>
      </div>
    </main>
  );
}
