import type { Metadata } from "next";
import { C_FAMILY, EARLIER } from "./palettes";
import { CompareStrip, PaletteBlock } from "./sample";

/*
 * Brand colour preview, for choosing a new brand colour. Not linked from anywhere, not in the sitemap, noindex.
 * Each palette is a wrapper that overrides the --af-* tokens from app/globals.css (hex and the -rgb channels the
 * Tailwind colours read), so the sample uses the site's own classes: .btn, .btn-blue, .btn-ghost, .t-hero,
 * .sticker-badge, bg-wall, text-ink-2 and so on. Nothing here changes the live site.
 * Palette data and contrast maths: palettes.ts. Sample, swatches, checks and the compare strip: sample.tsx.
 */

export const metadata: Metadata = {
  title: "Brand colour preview",
  robots: { index: false, follow: false },
};

export default function BrandPreviewPage() {
  return (
    <main id="main" tabIndex={-1} className="min-h-screen overflow-x-hidden bg-wall">
      <div className="mx-auto grid max-w-[1120px] gap-10 px-4 py-10 sm:px-6 md:py-14">
        <header className="grid gap-3">
          <p className="eyebrow">Internal preview</p>
          <h1 className="t-page">Brand colour preview</h1>
          <p className="max-w-[64ch] text-[17px] text-ink-2">
            Option C and four variations on its rose. Earlier options are further down. Nothing here changes the live site.
          </p>
          <nav aria-label="Palettes" className="flex flex-wrap gap-2 pt-1">
            {[...C_FAMILY, ...EARLIER].map((p) => (
              <a key={p.id} href={`#${p.id}`} className="btn btn-ghost btn-sm bg-white">
                {p.letter}. {p.name}
                {p.live ? " (Live)" : ""}
              </a>
            ))}
          </nav>
        </header>

        <CompareStrip palettes={C_FAMILY} />

        <section aria-labelledby="c-variations" className="grid gap-10">
          <div className="grid gap-2 border-t border-edge-strong pt-8">
            <h2 id="c-variations" className="t-section">
              Option C variations
            </h2>
            <p className="max-w-[64ch] text-[16px] text-ink-2">
              Same fonts, same sample. Each one also shows the site&rsquo;s money green, warning, error and yellow sticker.
            </p>
          </div>
          {C_FAMILY.map((p) => (
            <PaletteBlock key={p.id} p={p} full />
          ))}
        </section>

        <section aria-labelledby="earlier" className="grid gap-10">
          <div className="grid gap-2 border-t border-edge-strong pt-8">
            <h2 id="earlier" className="t-section">
              Earlier options
            </h2>
          </div>
          {EARLIER.map((p) => (
            <PaletteBlock key={p.id} p={p} />
          ))}
        </section>

        <p className="border-t border-line pt-6 text-[13.5px] text-ink-2">
          The artwork is from the seed data. The &ldquo;from&rdquo; price is the real smallest print price. The hue gap
          check is a rule of thumb: 25° or more keeps the rose from reading as the error red.
        </p>
      </div>
    </main>
  );
}
