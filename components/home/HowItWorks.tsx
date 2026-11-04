import { ReactNode } from "react";
import QRCode from "@/components/af/QRCode";
import { money } from "@/lib/earnings";

const DAB = [
  "M10 34C4 16 22 3 44 6s36 12 34 32-18 32-40 30S16 52 10 34Z",
  "M6 30C8 12 30 2 50 7s30 18 26 36-24 26-44 22S4 48 6 30Z",
  "M12 26C18 8 46 2 62 14s12 34-8 40-40 6-48-8-0-12 6-20Z",
];

/** A number painted with one dab of color. */
export function PaintNumber({ n, color }: { n: number; color: string }) {
  return (
    <span className="relative grid h-[68px] w-[76px] shrink-0 place-items-center" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 84 70">
        <path d={DAB[(n - 1) % 3]} fill={color} />
        <path d="M20 24c12-6 30-6 42 2M18 46c14 4 30 4 44-2" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".2" />
      </svg>
      <b className="display relative text-[44px] text-ink" style={{ color: color === "var(--af-ink)" || color === "var(--af-scan)" ? "#fff" : undefined }}>{n}</b>
    </span>
  );
}

function Step({ n, color, title, sub, children }: { n: number; color: string; title: string; sub: string; children: ReactNode }) {
  return (
    <li className="grid content-start gap-4">
      <div className="flex items-center gap-3">
        <PaintNumber n={n} color={color} />
        <div>
          <h3 className="display text-[30px] sm:text-[34px]">{title}</h3>
          <p className="text-[15px] text-ink-2">{sub}</p>
        </div>
      </div>
      <div className="grid h-[150px] place-items-center md:h-[176px] overflow-hidden rounded-xl bg-wall">{children}</div>
    </li>
  );
}

export default function HowItWorks({ art, perPrint, smallPerPrint }: { art: { imageUrl: string; title: string; slug: string }; perPrint: number; smallPerPrint: number }) {
  return (
    <section id="how" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <h2 className="display mb-10 text-[44px] sm:text-[60px] md:mb-14">Three steps. That’s it.</h2>
        <ol className="grid gap-12 md:grid-cols-3 md:gap-8">
          <Step n={1} color="var(--af-sticker)" title="Upload a photo" sub="We tell you what prints sharp.">
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art.imageUrl} alt="" className="h-[128px] w-auto rotate-[-3deg] border-[5px] border-white shadow-[0_10px_20px_-6px_rgba(21,22,27,.35)]" loading="lazy" />
              <span className="absolute -bottom-2 -right-12 rounded-full border-[1.5px] border-ink bg-white px-2.5 py-0.5 text-[12px] font-bold">Sharp to 18×24</span>
            </div>
          </Step>
          <Step n={2} color="var(--af-scan)" title="Hang your code" sub="Café, market, show, anywhere.">
            <div className="flex items-end gap-3">
              <div className="w-[96px] rotate-[2deg] rounded-md bg-white p-2 shadow-[0_8px_18px_-6px_rgba(21,22,27,.35)]">
                <QRCode value={`https://theartfinity.com/art/${art.slug}`} dots="dots" eyes="circle" eyeColor="#2b37f0" />
                <b className="mt-1 block text-[10px] leading-tight">Scan to buy a print</b>
              </div>
              <div className="w-[64px] -rotate-[4deg] rounded-full bg-sticker p-2.5 shadow-[0_8px_18px_-6px_rgba(21,22,27,.35)]">
                <QRCode value={`https://theartfinity.com/art/${art.slug}`} dots="rounded" eyes="rounded" />
              </div>
            </div>
          </Step>
          <Step n={3} color="var(--af-coral)" title="Get paid" sub="We print, ship and pay you monthly.">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-6 rounded-xl border-2 border-ink bg-white px-4 py-2.5 shadow-[4px_4px_0_var(--af-ink)]">
                <span className="text-[13px] leading-tight">Medium print<br /><span className="text-ink-2">{art.title}</span></span>
                <b className="num font-display text-[22px] text-earned [font-variation-settings:'wdth'_80]">+{money(perPrint)}</b>
              </div>
              <div className="ml-6 flex items-center justify-between gap-6 rounded-xl border-[1.5px] border-line bg-white px-4 py-2 opacity-80">
                <span className="text-[13px]">Small print</span>
                <b className="num font-display text-[18px] text-earned [font-variation-settings:'wdth'_80]">+{money(smallPerPrint)}</b>
              </div>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}
