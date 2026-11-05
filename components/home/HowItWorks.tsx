import { ReactNode } from "react";
import { ImageUp } from "lucide-react";
import QRCode from "@/components/af/QRCode";
import QRDraw from "@/components/motion/QRDraw";
import Stage from "@/components/motion/Stage";
import Odometer from "@/components/motion/Odometer";
import BrushWipe from "@/components/motion/BrushWipe";
import { money } from "@/lib/earnings";
import { scanUrl } from "@/lib/qr/render";
import { cn } from "@/lib/utils";
import s from "./HowItWorks.module.css";

const DAB = [
  "M10 34C4 16 22 3 44 6s36 12 34 32-18 32-40 30S16 52 10 34Z",
  "M6 30C8 12 30 2 50 7s30 18 26 36-24 26-44 22S4 48 6 30Z",
  "M12 26C18 8 46 2 62 14s12 34-8 40-40 6-48-8-0-12 6-20Z",
];

/** A number painted with one dab of color. */
export function PaintNumber({ n, color }: { n: number; color: string }) {
  return (
    <span className="relative grid h-[60px] w-[68px] shrink-0 place-items-center" aria-hidden="true">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 84 70">
        <path d={DAB[(n - 1) % 3]} fill={color} />
        <path d="M20 24c12-6 30-6 42 2M18 46c14 4 30 4 44-2" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".2" />
      </svg>
      <b className="display relative text-[40px] text-ink" style={{ color: color === "var(--af-ink)" || color === "var(--af-scan)" ? "#fff" : undefined }}>{n}</b>
    </span>
  );
}

function Step({ n, color, title, className, children }: { n: number; color: string; title: string; className?: string; children: ReactNode }) {
  return (
    <li className={cn("grid content-start gap-4", className)}>
      <div className="flex items-center gap-3">
        <PaintNumber n={n} color={color} />
        <h3 className="display text-[30px] sm:text-[34px]">{title}</h3>
      </div>
      <div className="grid h-[184px] place-items-center overflow-hidden rounded-xl bg-wall" aria-hidden="true">{children}</div>
    </li>
  );
}

const fmt = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function HowItWorks({ art, perPrint, smallPerPrint, monthBefore }: { art: { imageUrl: string; title: string; slug: string; artist?: { slug: string } }; perPrint: number; smallPerPrint: number; monthBefore: number }) {
  const to = fmt(monthBefore + perPrint);
  return (
    <section id="how" className="scroll-mt-20 border-t border-line">
      <div className="mx-auto max-w-[1240px] px-4 py-16 sm:px-6 md:py-24">
        <h2 className="display relative mb-10 inline-block text-[44px] sm:text-[60px] md:mb-14">
          <span className="relative z-10">Three steps.</span>
          <BrushWipe className="absolute -bottom-1 -left-2 z-0 h-[0.34em] w-[calc(100%+16px)]" color="var(--af-sticker)" />
        </h2>
        <Stage as="ol" className={cn(s.stage, "grid gap-12 md:grid-cols-3 md:gap-8")} threshold={0.25}>
          <Step n={1} color="var(--af-sticker)" title="Upload a photo" className={s.s1}>
            <div className="relative">
              <div className="relative h-[136px] w-[110px] rotate-[-3deg] overflow-hidden border-[5px] border-white bg-white shadow-[0_10px_20px_-6px_rgba(21,22,27,.35)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={art.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                <div className={cn(s.cover, "absolute inset-0 grid place-items-center content-center gap-2 border-2 border-dashed border-ink/25 bg-paper")}>
                  <ImageUp className="h-7 w-7 text-scan" strokeWidth={1.8} />
                  <div className="h-1.5 w-[64px] overflow-hidden rounded-full bg-line">
                    <div className={cn(s.bar, "h-full w-full rounded-full bg-scan")} />
                  </div>
                </div>
              </div>
              <span className={cn(s.badge, "absolute -bottom-2 -right-14 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-white px-2.5 py-0.5 text-[12px] font-bold")}>Sharp to 18×24</span>
            </div>
          </Step>
          <Step n={2} color="var(--af-scan)" title="Hang your code">
            <div className="flex items-end gap-3">
              <div className="w-[112px] rotate-[2deg] rounded-md bg-white p-2 shadow-[0_8px_18px_-6px_rgba(21,22,27,.35)]">
                <QRDraw value={scanUrl(art.slug, art.artist?.slug)} loop={7} label="" />
                <b className="mt-1 block text-[10.5px] leading-tight">Scan to buy a print</b>
              </div>
              <div className="w-[64px] -rotate-[4deg] rounded-full bg-sticker p-2.5 shadow-[0_8px_18px_-6px_rgba(21,22,27,.35)]">
                <QRCode value={scanUrl(art.slug, art.artist?.slug)} dots="rounded" eyes="rounded" />
              </div>
            </div>
          </Step>
          <Step n={3} color="var(--af-coral)" title="Get paid" className={s.s3}>
            <div className="grid w-[240px] gap-2">
              <div className="flex items-baseline justify-between px-1">
                <span className="text-[13px] text-ink-2">This month</span>
                <b className="display num text-[30px] text-earned"><Odometer from={fmt(monthBefore)} to={to} stripClassName={s.roll} /></b>
              </div>
              <div className={cn(s.sale, "flex items-center justify-between gap-4 rounded-xl border-2 border-ink bg-white px-3.5 py-2 shadow-[4px_4px_0_var(--af-ink)]")}>
                <span className="min-w-0 text-[13px] leading-tight">Medium print<br /><span className="block truncate text-ink-2">{art.title}</span></span>
                <b className="num font-display text-[22px] text-earned [font-variation-settings:'wdth'_80]">+{money(perPrint)}</b>
              </div>
              <div className="ml-5 flex items-center justify-between gap-4 rounded-xl border-[1.5px] border-line bg-white px-3.5 py-1.5 opacity-80">
                <span className="text-[13px]">Small print</span>
                <b className="num font-display text-[17px] text-earned [font-variation-settings:'wdth'_80]">+{money(smallPerPrint)}</b>
              </div>
            </div>
          </Step>
        </Stage>
      </div>
    </section>
  );
}
