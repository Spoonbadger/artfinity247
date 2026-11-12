import type { ReactNode } from "react";
import Image from "next/image";
import { Menu, ShoppingBag } from "lucide-react";
import Logo from "@/components/af/Logo";
import { Brushed } from "@/components/af/Brush";
import { basePrices } from "@/lib/artwork_price";
import { YELLOW_STICKER, checks, contrast, fullChecks, paletteStyle, resolved, type Palette, type Swatch } from "./palettes";

// Preview-only font hooks: palette B swaps in Bodoni and Roboto Mono, the others keep the site's own faces.
const HEAD =
  "[font-family:var(--pv-head-font,var(--font-display))] [font-weight:var(--pv-head-weight,800)] [letter-spacing:var(--pv-head-tracking,-0.02em)] text-[color:var(--pv-head-color,var(--af-ink))]";
const ACCENT = "[font-family:var(--pv-accent-font,var(--font-body))] [text-transform:var(--pv-accent-case,none)]";
const BODY = "[font-family:var(--pv-body-font,var(--font-body))]";
const TITLE = "[font-family:var(--pv-head-font,var(--font-body))]";

const THUMBS = [
  { src: "/seed/art-11.jpg", alt: "Seed artwork, warm reds" },
  { src: "/seed/art-01.jpg", alt: "Seed artwork, ochre" },
  { src: "/seed/art-12.jpg", alt: "Seed artwork, dark" },
  { src: "/seed/art-04.jpg", alt: "Seed artwork, pale" },
];

/**
 * The shared sample. `full` (the C palettes) adds a brush stroke under the hero, the site's functional colours,
 * a focus ring and a row of thumbnails, and uses the palette's own link and focus colours.
 */
export function Sample({ p, full = false }: { p: Palette; full?: boolean }) {
  // Uppercase mono labels (palette B) read large; set them a touch smaller and spaced.
  const label = (s: string) => (p.extra?.["--pv-accent-case"] === "uppercase" ? "text-[12.5px] tracking-[0.06em]" : s);
  const link = full ? "text-[color:var(--pv-link,var(--af-scan))]" : "text-scan";
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-edge bg-paper text-ink shadow-[0_12px_32px_-18px_rgba(21,22,27,.35)] ${
        full ? "[&_:focus-visible]:[outline-color:var(--pv-focus,var(--af-scan))]" : ""
      }`}
    >
      {/* Top nav: SiteHeader's markup, simplified */}
      <div className="border-b border-line bg-paper">
        <div className="flex items-center gap-2 px-3 py-3 sm:gap-4 sm:px-6">
          {p.oldLogo ? (
            <Image src="/assets/images/logo.png" alt="Artfinity" width={720} height={200} className="h-8 w-auto sm:h-9" />
          ) : (
            <Logo href={null} paint="var(--af-scan)" />
          )}
          <nav aria-label={`Sample navigation, palette ${p.letter}`} className={`ml-auto hidden items-center gap-6 font-medium md:flex ${ACCENT} ${label("text-[15px]")}`}>
            <span className={full ? link : "text-scan"}>Browse art</span>
            <span className="text-ink">Artists</span>
            <span className="text-ink">How it works</span>
            <span className="text-ink">Log in</span>
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <span className="grid h-11 w-9 place-items-center rounded-full text-ink sm:w-11" aria-hidden="true">
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
          <h3 className={`t-hero ${HEAD}`}>
            {full ? (
              <>
                Find a painting you <Brushed color="var(--af-sticker)">love.</Brushed> Take home a print.
              </>
            ) : (
              "Find a painting you love. Take home a print."
            )}
          </h3>
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
        {full && (
          <span className="btn btn-ghost" style={{ outline: "3px solid var(--pv-focus, var(--af-scan))", outlineOffset: 2 }}>
            Focus ring
          </span>
        )}
        <a href={`#${p.id}`} className={`text-[15px] font-semibold underline underline-offset-2 ${link} ${BODY}`}>A text link</a>
      </div>

      {full && <SiteColours />}

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

/** The functional colours from app/globals.css next to the palette: money, warning, error, danger, yellow paint. */
function SiteColours() {
  return (
    <div className="grid gap-4 border-t border-line bg-paper px-4 py-6 sm:px-6">
      <p className="eyebrow">Site colours</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="num rounded-full bg-earned-soft px-3 py-1 text-[14px] font-semibold text-earned">+$42.00 earned</span>
        <button type="button" className="btn btn-sm bg-coral text-white">Delete artwork</button>
        <span className="flex flex-wrap items-center gap-3" style={YELLOW_STICKER}>
          <button type="button" className="btn btn-sm btn-sticker">Print all</button>
          <span className="sticker-badge">New</span>
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="flex items-start gap-2 rounded-xl border border-coral bg-paper px-3 py-2 text-[14px] text-ink">
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-coral" aria-hidden="true" />
          Payout on hold. Add your bank details.
        </p>
        <p className="self-center text-[14px] font-semibold text-coral">Card declined. Try another card.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {THUMBS.map((t) => (
          <Image
            key={t.src}
            src={t.src}
            alt={t.alt}
            width={1200}
            height={1500}
            sizes="64px"
            className="h-20 w-16 rounded-[3px] bg-white object-cover shadow-[0_1px_0_rgba(21,22,27,.08),0_8px_16px_-6px_rgba(21,22,27,.35)]"
          />
        ))}
      </div>
    </div>
  );
}

function SwatchGrid({ items, label, small = false }: { items: Swatch[]; label: string; small?: boolean }) {
  return (
    <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${small ? "lg:grid-cols-5" : "lg:grid-cols-7"}`} aria-label={label}>
      {items.map((s) => (
        <li key={s.hex + s.name} className="grid content-start gap-1.5">
          <span className={`block rounded-xl border border-black/10 ${small ? "h-8" : "h-14"}`} style={{ background: s.hex }} aria-hidden="true" />
          <span className="text-[14px] font-semibold leading-tight text-ink">{s.name}</span>
          <code className="text-[13px] text-ink">{s.hex}</code>
          <span className="text-[13px] leading-snug text-ink-2">{s.role}</span>
        </li>
      ))}
    </ul>
  );
}

export function Swatches({ p }: { p: Palette }) {
  return (
    <div className="grid gap-5">
      <SwatchGrid items={p.swatches} label={`Palette ${p.letter} colours`} />
      {p.support && <SwatchGrid items={p.support} label={`Palette ${p.letter} supporting colours`} small />}
    </div>
  );
}

export function Checks({ p, full = false }: { p: Palette; full?: boolean }) {
  const list = full ? fullChecks(p) : checks(p);
  const failing = list.filter((c) => c.value < c.need).length;
  return (
    <details className="rounded-xl border border-edge bg-white px-4 py-3 text-[14px]" open={full}>
      <summary className="cursor-pointer font-semibold text-ink">
        Contrast: primary button text {contrast("#ffffff", p.tokens.scan).toFixed(2)}:1
        {full && (failing ? `, ${failing} to look at` : ", all pass")}
      </summary>
      <ul className="mt-2 grid gap-1">
        {list.map((c) => (
          <li key={c.label} className="flex flex-wrap justify-between gap-x-4 border-t border-line pt-1 text-ink-2">
            <span>{c.label}</span>
            <span className="num font-semibold text-ink">
              {c.unit === "deg"
                ? `${Math.round(c.value)}° ${c.value >= c.need ? `apart (aim ${c.need}+)` : "apart, too close"}`
                : `${c.value.toFixed(2)}:1 ${c.value >= c.need ? `passes (needs ${c.need})` : `below ${c.need}`}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function Section({ p, children }: { p: Palette; children: ReactNode }) {
  return (
    <section id={p.id} aria-labelledby={`${p.id}-title`} className="grid scroll-mt-6 gap-5 border-t border-line pt-10">
      <div className="grid gap-2">
        <p className="eyebrow">Palette {p.letter}</p>
        <h3 id={`${p.id}-title`} className="t-section">
          {p.letter}. {p.name}
        </h3>
        <p className="max-w-[70ch] text-[16px] text-ink-2">{p.blurb}</p>
      </div>
      {children}
    </section>
  );
}

/** One palette, start to finish: sample, swatches, note, contrast. */
export function PaletteBlock({ p, full = false }: { p: Palette; full?: boolean }) {
  return (
    <Section p={p}>
      <div className={p.className} style={paletteStyle(p)}>
        <Sample p={p} full={full} />
      </div>
      <Swatches p={p} />
      {p.note && <p className="max-w-[80ch] text-[14px] text-ink-2">{p.note}</p>}
      <Checks p={p} full={full} />
    </Section>
  );
}

const STRIP_ROLES = [
  { key: "scan", label: "Primary" },
  { key: "ink", label: "Ink" },
  { key: "ink-2", label: "Quiet ink" },
  { key: "sticker", label: "Badge" },
  { key: "wall", label: "Section" },
  { key: "paper", label: "Page" },
] as const;

/** The five C palettes side by side, each row linking to its full sample. */
export function CompareStrip({ palettes }: { palettes: Palette[] }) {
  return (
    <section id="compare" aria-labelledby="compare-title" className="grid scroll-mt-6 gap-4">
      <h2 id="compare-title" className="t-section">
        Compare
      </h2>
      <div className="hidden grid-cols-[200px_1fr_150px] gap-4 px-3 sm:grid" aria-hidden="true">
        <span />
        <span className="grid grid-cols-6 gap-2">
          {STRIP_ROLES.map((r) => (
            <span key={r.key} className="eyebrow">
              {r.label}
            </span>
          ))}
        </span>
        <span />
      </div>
      <ul className="grid gap-2">
        {palettes.map((p) => {
          const c = resolved(p);
          return (
            <li key={p.id}>
              <a
                href={`#${p.id}`}
                className="grid gap-3 rounded-2xl border border-edge bg-white p-3 text-ink no-underline transition-colors hover:border-ink sm:grid-cols-[200px_1fr_150px] sm:items-center sm:gap-4"
              >
                <span className="grid gap-0.5">
                  <span className="text-[16px] font-bold leading-tight">
                    {p.letter}. {p.name}
                  </span>
                  <span className="text-[13px] text-ink-2">{p.letter === "C" ? "The original" : "Variation"}</span>
                </span>
                <span className="grid grid-cols-6 gap-1.5 sm:gap-2">
                  {STRIP_ROLES.map((r) => (
                    <span key={r.key} className="grid min-w-0 gap-1">
                      <span className="block h-10 rounded-lg border border-black/10 sm:h-12" style={{ background: c[r.key] }} title={`${r.label} ${c[r.key]}`} />
                      <code className="hidden truncate text-[13px] text-ink-2 sm:block">{c[r.key]}</code>
                    </span>
                  ))}
                </span>
                <span className="flex items-center justify-between gap-3 sm:justify-end" style={paletteStyle(p)}>
                  <span className="num text-[13px] text-ink-2">{contrast("#ffffff", c.scan).toFixed(2)}:1</span>
                  <span className="btn btn-blue btn-sm">Buy</span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
