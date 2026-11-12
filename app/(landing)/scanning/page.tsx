import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Brushed } from "@/components/af/Brush";
import { DabRow } from "@/components/browse/PageHead";
import Splat from "@/components/motion/Splat";
import BrushWipe from "@/components/motion/BrushWipe";
import Waitlist from "@/components/scanning/Waitlist";
import { readScanSettings } from "@/lib/scanning.server";
import { LARGEST_PRINT, bandRange, careTextFor, oversizedRange, usd } from "@/lib/scanning";
import { PRINT_SIZES, SIZE_LABEL, sizeInches } from "@/components/art/pricing";
import { FREE_SPLIT, pct } from "@/lib/plans";
import { PAINTING_SCANS } from "@/lib/features";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Painting scans",
  description: `We scan your original paintings in NYC, high-res and colour-accurate, and put the files straight onto your artworks so you can sell prints up to ${LARGEST_PRINT}.`,
};

const BOOK = "/studio/scanning";

export default async function ScanningPage() {
  if (!PAINTING_SCANS) notFound();
  const s = await readScanSettings();
  const on = s.enabled;
  const steps: [string, string, string][] = [
    ["var(--af-sticker)", "Book", "Pick the paintings in your Studio, already uploaded or not, and a few days that work. We confirm the date and price."],
    ["var(--af-scan)", "Drop off, or we pick up", "Bring them to our NYC studio, or we collect them anywhere in the five boroughs."],
    ["var(--af-earned)", `Files on your art in ${s.turnaroundDays} days`, "The scans go straight onto your artworks. Every print size unlocks, and your paintings come home."],
  ];
  const faq: [string, React.ReactNode][] = [
    ["Who can book?", <>Any artist with an Artfinity page. Scanning happens in New York City: drop-off works if you can get to us, and pickup covers the five boroughs. Don&apos;t have a page yet? <Link href="/register">It&apos;s free to start</Link>.</>],
    ["What do I get?", <>A high-resolution, colour-accurate file of each painting. It replaces the photo on your artwork, so buyers see a truer image and can order every size up to {LARGEST_PRINT}. You can download the full file from the piece&apos;s page in your Studio.</>],
    ["Do the paintings need to be on Artfinity already?", "No. When you book, add a count of pieces you haven't uploaded yet. Upload them afterwards (a phone photo is fine) and we attach the scans."],
    ["My painting is framed. Is that OK?", "Take it out of the frame if you can: glass and frame edges cause glare and shadows. If it can't come out, say so in the notes and we'll talk it through before you bring it."],
    ["What about very big pieces?", `Anything ${oversizedRange(s.bands)} gets a quote. Book it as "oversized" and we'll reply with a price before you pay anything.`],
    ["When do I pay?", "Only after we confirm your date and the final price. Booking is free and you can cancel from your Studio until you pay."],
    ["How long does it take?", `The files are on your artworks within ${s.turnaroundDays} days of us receiving your paintings, and the paintings are back with you within ${s.returnDays} days.`],
    ["Are my paintings covered while you have them?", "Tell us about anything especially valuable or fragile when you book. We'll go over how pieces in our care are looked after and covered before you hand them over."],
    ["Does it change what I earn?", `No. Prints from a scan sell like any other: you set the prices and keep ${pct(FREE_SPLIT)} of the profit. Bigger sizes just mean bigger sales.`],
  ];

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1240px] items-center gap-12 px-4 pb-16 pt-10 sm:px-6 md:pt-16 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <DabRow />
              <span className="eyebrow">Painting scans · NYC only</span>
              {!on && <span className="sticker-badge">Coming soon</span>}
            </div>
            <h1 className="display text-[52px] sm:text-[80px]">
              Phone photo<br />too small?<br /><Brushed color="var(--af-scan-soft)"><span className="text-scan">We scan the original.</span></Brushed>
            </h1>
            <p className="mt-5 max-w-[44ch] text-[19px] text-ink-2">
              Sell prints up to {LARGEST_PRINT} that look like the painting on your wall. We scan it in NYC, high-res and colour-accurate, and the file goes straight onto your artwork.
            </p>
            {on ? (
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={BOOK} className="btn btn-blue btn-lg">Book a scan</Link>
                <a href="#prices" className="btn btn-ghost btn-lg">See prices</a>
              </div>
            ) : (
              <div className="mt-7 grid gap-3">
                <p className="text-[16px] font-semibold">Coming soon — join the waitlist.</p>
                <Waitlist source="public" />
              </div>
            )}
          </div>

          {/* Before and after: what a phone photo prints vs a scan */}
          <div className="grid gap-4" aria-label="What a scan unlocks">
            <SizeCard title="A typical phone photo" note="Soft or hidden from buyers above this" sizes={PRINT_SIZES.slice(0, 2)} tone="muted" />
            <SizeCard title="An Artfinity scan" note={`Every size, up to ${LARGEST_PRINT}`} sizes={PRINT_SIZES} tone="scan" />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-wall">
        <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20">
          <h2 className="display text-[44px] sm:text-[60px]">Why it matters</h2>
          <ul className="mt-8 grid gap-x-6 gap-y-8 md:grid-cols-3">
            {[
              ["Bigger prints sell for more", `Each print size needs enough pixels to stay sharp. Most phone photos stop at ${SIZE_LABEL.medium} or ${SIZE_LABEL.large}; a scan unlocks ${SIZE_LABEL.xl} (${sizeInches("xl")}).`],
              ["Colour you'd sign", "Even light, no glare, no warm living-room cast. Buyers get the colours you mixed, not the colours of your lamp."],
              ["No more re-shoots", "One appointment and the files are on your artworks. Nothing to edit, crop or re-upload."],
            ].map(([t, d], i) => (
              <li key={t} className="grid content-start gap-1.5 border-t-[3px] border-ink pt-4">
                <Splat><span className="paint-dab mb-1 h-5 w-5" style={{ ["--dab" as string]: ["var(--af-coral)", "var(--af-scan)", "var(--af-earned)"][i] }} aria-hidden="true" /></Splat>
                <b className="font-display text-[24px] leading-none [font-variation-settings:'wdth'_80]">{t}</b>
                <span className="text-[15px] text-ink-2">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24" aria-labelledby="how-h">
        <h2 id="how-h" className="display relative mb-10 inline-block text-[44px] sm:text-[60px]">
          <span className="relative z-10">How it works</span>
          <BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-sticker)" style={{ opacity: 0.45 }} />
        </h2>
        <ol className="grid gap-6 md:grid-cols-3">
          {steps.map(([c, t, d], i) => (
            <li key={t} className="af-card grid content-start gap-2 p-5">
              <span className="flex items-center gap-2">
                <span className="paint-dab h-6 w-6" style={{ ["--dab" as string]: c }} aria-hidden="true" />
                <span className="num text-[13px] font-bold text-ink-2">Step {i + 1}</span>
              </span>
              <b className="font-display text-[26px] leading-tight [font-variation-settings:'wdth'_80]">{t}</b>
              <span className="text-[15px] text-ink-2">{d}</span>
            </li>
          ))}
        </ol>
      </section>

      {on && (
        <section id="prices" className="scroll-mt-24 border-y border-line bg-wall" aria-labelledby="prices-h">
          <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <h2 id="prices-h" className="display text-[44px] sm:text-[60px]">Prices</h2>
              <p className="mt-3 max-w-[44ch] text-[16px] text-ink-2">Priced per painting, by its size. Booking is free: you pay once we&apos;ve confirmed your date and the final price.</p>
            </div>
            <div className="af-card overflow-hidden">
              <table className="w-full text-left text-[15.5px]">
                <caption className="sr-only">Scan prices by painting size</caption>
                <thead className="border-b border-line text-[13px] text-ink-2">
                  <tr><th scope="col" className="px-5 py-3 font-semibold">Painting size</th><th scope="col" className="px-5 py-3 text-right font-semibold">Per painting</th></tr>
                </thead>
                <tbody>
                  {s.bands.map((b) => (
                    <tr key={b.key} className="border-b border-line">
                      <th scope="row" className="px-5 py-3.5 font-normal"><b className="block">{b.label}</b><span className="text-[13.5px] text-ink-2">{bandRange(b)}</span></th>
                      <td className="num px-5 py-3.5 text-right font-bold">{b.priceCents != null ? usd(b.priceCents) : <span className="font-semibold text-ink-2">Ask for a quote</span>}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-line">
                    <th scope="row" className="px-5 py-3.5 font-normal"><b className="block">Oversized</b><span className="text-[13.5px] text-ink-2">{oversizedRange(s.bands)}</span></th>
                    <td className="px-5 py-3.5 text-right font-semibold text-ink-2">Ask for a quote</td>
                  </tr>
                  <tr>
                    <th scope="row" className="px-5 py-3.5 font-normal"><b className="block">NYC pickup</b><span className="text-[13.5px] text-ink-2">per booking, five boroughs</span></th>
                    <td className="num px-5 py-3.5 text-right font-bold">{s.pickupFeeCents != null ? (s.pickupFeeCents ? usd(s.pickupFeeCents) : "Free") : <span className="font-semibold text-ink-2">Quoted when we confirm</span>}</td>
                  </tr>
                </tbody>
              </table>
              <p className="border-t border-line bg-white px-5 py-3 text-[13.5px] text-ink-2">Drop-off at our NYC studio is free. We send the address when we confirm.</p>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-20" aria-labelledby="care-h">
        <div className="grid gap-6 rounded-2xl border border-edge bg-[#fffbe8] p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-start">
          <span className="paint-dab h-10 w-10" style={{ ["--dab" as string]: "var(--af-earned)" }} aria-hidden="true" />
          <div className="grid gap-2">
            <h2 id="care-h" className="display text-[36px] sm:text-[44px]">Your paintings, in good hands</h2>
            <p className="max-w-[64ch] text-[16.5px] leading-relaxed text-ink-2">{careTextFor(s)}</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[820px] px-4 pb-20 sm:px-6" aria-labelledby="faq-h">
        <h2 id="faq-h" className="display mb-6 text-[40px] sm:text-[52px]">Questions</h2>
        <div className="divide-y divide-line border-y border-line">
          {faq.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[18px] font-semibold [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="pb-5 text-[16.5px] leading-relaxed text-ink-2 [&_a]:font-semibold [&_a]:text-scan [&_a]:underline">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-[14px] text-ink-2">More in the help center: <Link href="/help/selling/painting-scans" className="font-semibold text-scan underline">Getting your paintings scanned</Link>.</p>
      </section>

      <section className="relative overflow-hidden bg-ink text-white">
        <BrushWipe className="pointer-events-none absolute -right-20 top-8 h-12 w-[380px] -rotate-[5deg] opacity-30" color="var(--af-scan)" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr]">
          <h2 className="display text-[48px] text-white sm:text-[68px]">{on ? "Make every size sharp." : "Scanning is coming."}</h2>
          {on ? (
            <div className="flex flex-wrap gap-3 lg:justify-self-end">
              <Link href={BOOK} className="btn btn-lg border-white bg-white text-ink">Book a scan</Link>
              <Link href="/register" className="btn btn-lg btn-ghost border-white/60 text-white hover:border-white">New here? Start free</Link>
            </div>
          ) : (
            <Waitlist source="public" dark className="lg:justify-self-end" />
          )}
        </div>
      </section>
    </>
  );
}

function SizeCard({ title, note, sizes, tone }: { title: string; note: string; sizes: readonly string[]; tone: "muted" | "scan" }) {
  return (
    <div className={tone === "scan" ? "af-card grid gap-3 p-5" : "grid gap-3 rounded-2xl border border-dashed border-line bg-wall p-5"}>
      <div className="flex items-baseline justify-between gap-3">
        <b className="text-[17px]">{title}</b>
        <span className={tone === "scan" ? "text-[13px] font-semibold text-earned" : "text-[13px] text-ink-2"}>{note}</span>
      </div>
      <ul className="flex flex-wrap items-end gap-2">
        {PRINT_SIZES.map((s) => {
          const ok = sizes.includes(s);
          const [w, h] = s === "small" ? [28, 40] : s === "medium" ? [36, 54] : s === "large" ? [44, 68] : [58, 78];
          return (
            <li key={s} className="grid justify-items-center gap-1">
              <span
                className={ok ? (tone === "scan" ? "rounded-[2px] bg-scan shadow-[0_6px_14px_-4px_rgba(21,22,27,.4)]" : "rounded-[2px] bg-ink-2/60") : "rounded-[2px] border-2 border-dashed border-ink/25"}
                style={{ width: w, height: h }}
                aria-hidden="true"
              />
              <span className={ok ? "text-[13px] font-bold" : "text-[13px] text-ink-2 line-through"}>
                {SIZE_LABEL[s as keyof typeof SIZE_LABEL]}<span className="sr-only">{ok ? " (sharp)" : " (too small)"}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
