import Link from "next/link";
import { Check } from "lucide-react";
import QRCode from "@/components/af/QRCode";
import { BrushStroke, Swatch } from "@/components/af/Brush";
import SensitiveImage from "@/components/site/SensitiveImage";
import Stage from "@/components/motion/Stage";
import Odometer from "@/components/motion/Odometer";
import { scanUrl } from "@/lib/qr/render";
import { artistPath, artPath } from "@/lib/urls";
import { money } from "@/lib/earnings";
import s from "./HeroStory.module.css";

export type HeroArt = { slug: string; title: string; imageUrl: string; sensitive: string[]; artist: { name: string; slug: string } };

const fmt = (cents: number) => "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The hero, as an 11-second story told with a real seeded piece:
 * a phone scans the QR card on a café wall, the buy card opens, the print is boxed,
 * and the artist's earnings chip rolls up. The resting frame tells the whole story at once.
 */
export default function HeroStory({ art, perPrint, price, monthBefore }: { art: HeroArt; perPrint: number; price: number; monthBefore: number }) {
  const first = art.artist.name.split(" ")[0];
  const after = monthBefore + perPrint;
  const to = fmt(after);
  const from = fmt(monthBefore).padStart(to.length, " ");
  const qr = scanUrl(art.slug, art.artist.slug);

  const painting = (
    <SensitiveImage labels={art.sensitive} light>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={art.imageUrl} alt="" className="h-full w-full object-cover" fetchPriority="high" />
    </SensitiveImage>
  );

  return (
    <div className="mx-auto w-full max-w-[600px]">
      <Stage
        className={`${s.scene} relative aspect-[1/1.02] w-full overflow-hidden rounded-[22px] border-[1.5px] border-ink/10`}
        style={{ background: "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,.55), transparent 60%), radial-gradient(60% 50% at 85% 75%, rgba(21,22,27,.05), transparent 70%), var(--af-gallery)" }}
        role="img"
        aria-label={`${art.title} by ${art.artist.name} on a café wall. A phone scans its QR code, a print is bought and boxed, and ${first} earns ${money(perPrint)}.`}
      >
        <div aria-hidden="true">
          {/* painted wall */}
          <BrushStroke className="absolute -left-10 top-[8%] h-[15%] w-[85%] -rotate-[8deg] opacity-[.55]" color="var(--af-sticker)" />
          <BrushStroke className="absolute -right-16 top-[64%] h-[6%] w-[55%] rotate-[6deg] opacity-25" color="var(--af-scan)" />

          {/* the painting */}
          <div className="absolute left-[8%] top-[11cqw] w-[44%] rotate-[-1deg] bg-white p-[3.2%] shadow-[0_2px_0_rgba(21,22,27,.06),0_22px_40px_-10px_rgba(21,22,27,.45)] ring-[5px] ring-ink">
            <div className="aspect-[4/5] overflow-hidden">{painting}</div>
          </div>

          {/* the QR card, taped up */}
          <div className="absolute left-[63%] top-[31cqw] w-[22%] rotate-[3deg] rounded-[6px] bg-white p-[1.8%] shadow-[0_10px_22px_-6px_rgba(21,22,27,.35)]">
            <span className="absolute -top-[1.4cqw] left-1/2 h-[2.6cqw] w-[7cqw] -translate-x-1/2 -rotate-3 bg-sticker/80" />
            <QRCode value={qr} dots="rounded" eyes="frame" eyeColor="#2b37f0" />
            <b className="mt-[0.8cqw] block text-[1.9cqw] leading-tight text-ink">Scan to buy a print</b>
          </div>

          {/* the artist's earnings chip */}
          <div className={`${s.chip} absolute left-[60%] top-[4cqw] w-[34%] rounded-[3px] border border-line bg-white p-[1.2cqw] pb-[1.6cqw] shadow-[0_2px_0_var(--af-line),0_12px_24px_-12px_rgba(21,22,27,.35)]`}>
            <Swatch color="var(--af-earned)" className="mb-[1cqw] h-[4.5cqw]" />
            <b className="display num block px-[0.6cqw] text-[5cqw] text-earned"><Odometer from={from} to={to} stripClassName={s.roll} /></b>
            <span className="block px-[0.6cqw] text-[1.9cqw] leading-tight text-ink-2">{first} this month</span>
          </div>
          <div className={`${s.pill} absolute left-[79%] top-[20.5cqw] rounded-full border-2 border-ink bg-white px-[1.8cqw] py-[0.5cqw] shadow-[3px_3px_0_var(--af-ink)]`}>
            <b className="num font-display text-[3cqw] text-earned [font-variation-settings:'wdth'_80]">+{money(perPrint)}</b>
          </div>

          {/* floor */}
          <div className="absolute inset-x-0 bottom-0 h-[12%] bg-[#d7d1c4]"><div className="h-[3px] bg-[#c9c2b3]" /></div>

          {/* the box: a print drops in, the lid closes, it ships */}
          <div className={`${s.box} absolute left-[14%] top-[73cqw] w-[22%]`}>
            <div className="relative aspect-[5/3.2]">
              <div className="absolute inset-0 rounded-[2px] bg-[#a87c4f]" />
              <div className={`${s.boxPrint} absolute left-[30%] top-[-6%] w-[40%] bg-white p-[4%] shadow-[0_6px_12px_-4px_rgba(21,22,27,.4)]`}>
                <div className="aspect-[4/5] overflow-hidden">{painting}</div>
              </div>
              <div className="absolute inset-x-0 bottom-0 top-[16%] rounded-[2px] bg-[#c4935f] shadow-[inset_0_-6px_0_rgba(0,0,0,.08)]">
                <span className="absolute left-[8%] top-[22%] h-[10%] w-[30%] rounded-full bg-black/10" />
              </div>
              <div className={`${s.lid} absolute left-0 top-[4%] h-[14%] w-full rounded-[2px] bg-[#b6865a]`} />
              <span className={`${s.tape} absolute left-[38%] top-[4%] h-[30%] w-[24%] bg-sticker/90`} />
              <span className={`${s.shipped} absolute -right-[18%] -top-[26%] rounded-full bg-ink px-[1.4cqw] py-[0.4cqw] text-[1.9cqw] font-bold text-white`}>Shipped</span>
            </div>
          </div>

          {/* the phone */}
          <div className={`${s.phone} absolute left-[59%] top-[58cqw] w-[28%]`}>
            <div className="relative aspect-[9/19] rounded-[4.2cqw] bg-ink p-[1.1cqw] shadow-[0_24px_40px_-14px_rgba(21,22,27,.55)]">
              <div className="relative h-full overflow-hidden rounded-[3.3cqw] bg-white">
                <span className="absolute left-1/2 top-[1.1cqw] z-20 h-[1.6cqw] w-[7cqw] -translate-x-1/2 rounded-full bg-ink" />
                {/* buy screen (the real scan page, in miniature) */}
                <div className="grid justify-items-center gap-[0.9cqw] px-[2cqw] pt-[4.6cqw]">
                  <div className="w-[66%] bg-white p-[0.7cqw] shadow-[0_4px_10px_-4px_rgba(21,22,27,.4)]">
                    <div className="aspect-[4/5] overflow-hidden">{painting}</div>
                  </div>
                  <b className="mt-[0.4cqw] w-full truncate text-center text-[2.1cqw] leading-tight text-ink">{art.title}</b>
                  <span className="-mt-[0.6cqw] w-full truncate text-center text-[1.6cqw] text-ink-2">{art.artist.name} · Medium print</span>
                  <b className="num font-display text-[3cqw] leading-none [font-variation-settings:'wdth'_80]">{money(price)}</b>
                  <div className="relative mt-[0.2cqw] w-full">
                    <span className="block rounded-full bg-scan py-[1.1cqw] text-center text-[1.9cqw] font-bold text-white">Buy this print</span>
                    <span className={`${s.ordered} absolute inset-0 flex items-center justify-center gap-[0.6cqw] rounded-full bg-earned text-[1.9cqw] font-bold text-white`}>
                      <Check className="h-[2.2cqw] w-[2.2cqw]" strokeWidth={3} /> Ordered
                    </span>
                    <span className={`${s.ripple} absolute left-[58%] top-1/2 -ml-[2.5cqw] -mt-[2.5cqw] h-[5cqw] w-[5cqw] rounded-full bg-ink`} />
                  </div>
                </div>
                {/* camera screen */}
                <div className={`${s.cam} absolute inset-0 z-10 grid place-items-center bg-[#d9d3c6]`}>
                  <div className="relative w-[64%] -translate-y-[30%]">
                    <div className="rounded-[1cqw] bg-white p-[1.2cqw] shadow-[0_6px_14px_-6px_rgba(21,22,27,.4)]">
                      <QRCode value={qr} dots="rounded" eyes="frame" eyeColor="#2b37f0" />
                    </div>
                    <div className="pointer-events-none absolute -inset-[1.6cqw]">
                      <span className="absolute left-0 top-0 h-[3cqw] w-[3cqw] rounded-tl-[1cqw] border-l-[0.6cqw] border-t-[0.6cqw] border-white" />
                      <span className="absolute right-0 top-0 h-[3cqw] w-[3cqw] rounded-tr-[1cqw] border-r-[0.6cqw] border-t-[0.6cqw] border-white" />
                      <span className="absolute bottom-0 left-0 h-[3cqw] w-[3cqw] rounded-bl-[1cqw] border-b-[0.6cqw] border-l-[0.6cqw] border-white" />
                      <span className="absolute bottom-0 right-0 h-[3cqw] w-[3cqw] rounded-br-[1cqw] border-b-[0.6cqw] border-r-[0.6cqw] border-white" />
                      <span className={`${s.found} absolute inset-0 rounded-[1.4cqw] border-[0.6cqw] border-scan`} />
                      <div className={`${s.camSweep} absolute inset-x-[1.6cqw] inset-y-[1.6cqw]`}>
                        <span className="absolute inset-x-0 top-0 h-[0.6cqw] rounded-full bg-scan shadow-[0_0_2cqw_0.6cqw_rgba(43,55,240,.45)]" />
                      </div>
                    </div>
                    <span className="absolute -bottom-[7cqw] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-[1.4cqw] py-[0.4cqw] text-[1.7cqw] font-semibold text-white">theartfinity.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Stage>
      <p className="mt-3 pl-1 text-[13px] text-ink-2">
        On the wall: <Link href={artPath(art.artist.slug, art.slug)} className="font-semibold text-ink no-underline hover:underline">{art.title}</Link> by{" "}
        <Link href={artistPath(art.artist.slug)} className="text-ink no-underline hover:underline">{art.artist.name}</Link>
      </p>
    </div>
  );
}
