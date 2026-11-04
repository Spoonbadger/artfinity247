import Link from "next/link";
import QRCode from "@/components/af/QRCode";
import { BrushStroke } from "@/components/af/Brush";
import SensitiveImage from "@/components/site/SensitiveImage";
import { scanUrl } from "@/lib/qr/render";
import { money } from "@/lib/earnings";

type HeroArt = { slug: string; title: string; imageUrl: string; sensitive: string[]; artist: { name: string; slug: string } };

/** Painterly blob used as wall paint swatches. */
function Blob({ className, color, d = 0 }: { className?: string; color: string; d?: number }) {
  const paths = [
    "M12 30C6 14 22 2 40 6s34 6 36 24-10 34-30 34S18 46 12 30Z",
    "M8 26C10 10 30 4 46 8s26 14 22 30-20 26-36 22S6 42 8 26Z",
    "M14 22C20 6 44 4 58 14s14 30-4 38-36 6-44-6-2-16 4-24Z",
  ];
  return (
    <svg className={className} viewBox="0 0 80 64" aria-hidden="true">
      <path d={paths[d % 3]} fill={color} />
      <path d="M22 22c10-4 24-4 34 2" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".22" />
    </svg>
  );
}

/** Hero visual: a real piece on a gallery wall, its QR card beside it, sales popping in. */
export default function HeroWall({ art, perPrint }: { art: HeroArt; perPrint: number }) {
  return (
    <div className="mx-auto w-full max-w-[600px]">
      <div className="relative">
      <style>{`@keyframes af-float{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-7px) rotate(var(--r,0deg))}}.af-float{animation:af-float 5.5s ease-in-out infinite}`}</style>
      <div
        className="relative aspect-[1/1.02] w-full overflow-hidden rounded-[22px] border-[1.5px] border-ink/10"
        style={{
          background:
            "radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,.55), transparent 60%), radial-gradient(60% 50% at 85% 75%, rgba(21,22,27,.05), transparent 70%), var(--af-gallery)",
        }}
        role="img"
        aria-label={`${art.title} by ${art.artist.name}, hanging on a wall with a QR code card beside it`}
      >
        {/* painted wall accents */}
        <BrushStroke className="absolute -left-10 top-[9%] h-[15%] w-[85%] -rotate-[8deg] opacity-[.55]" color="var(--af-sticker)" />
        <BrushStroke className="absolute -right-16 top-[62%] h-[6%] w-[55%] rotate-[6deg] opacity-25" color="var(--af-scan)" />

        {/* the painting, matted and framed */}
        <div className="absolute left-[11%] top-[11%] w-[48%] rotate-[-1deg] bg-white p-[3.2%] shadow-[0_2px_0_rgba(21,22,27,.06),0_22px_40px_-10px_rgba(21,22,27,.45)] ring-[5px] ring-ink">
          <div className="aspect-[4/5] overflow-hidden">
            <SensitiveImage labels={art.sensitive} light>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art.imageUrl} alt="" className="h-full w-full object-cover" fetchPriority="high" />
            </SensitiveImage>
          </div>
        </div>

        {/* the QR card, taped up */}
        <div className="absolute left-[65%] top-[34%] w-[25%] rotate-[3deg] rounded-[6px] bg-white p-[2.2%] shadow-[0_10px_22px_-6px_rgba(21,22,27,.35)]">
          <span className="absolute -top-2.5 left-1/2 h-4 w-10 -translate-x-1/2 -rotate-3 bg-sticker/80" aria-hidden="true" />
          <QRCode value={scanUrl(art.slug)} dots="rounded" eyes="frame" eyeColor="#2b37f0" />
          <b className="mt-1.5 block text-[clamp(8px,1.6vw,12px)] leading-tight text-ink">Scan to buy a print</b>
          <span className="block truncate text-[clamp(7px,1.3vw,10.5px)] text-ink-2">{art.title}</span>
        </div>

        {/* paint swatches on the wall */}
        <div className="absolute bottom-[17%] left-[64%] flex w-[28%] items-end" aria-hidden="true">
          <Blob className="w-[42%] -rotate-12" color="var(--af-scan)" d={0} />
          <Blob className="-ml-[10%] w-[34%] rotate-12" color="var(--af-coral)" d={1} />
          <Blob className="-ml-[8%] mb-[6%] w-[30%]" color="var(--af-sticker)" d={2} />
        </div>

        {/* floor / bench */}
        <div className="absolute inset-x-0 bottom-0 h-[13%] bg-[#d7d1c4]" aria-hidden="true">
          <div className="h-[3px] bg-[#c9c2b3]" />
        </div>
      </div>

      {/* sale notifications */}
      <div className="af-float absolute -right-1 bottom-[4%] rounded-2xl border-2 border-ink bg-white px-3.5 py-2 text-[13px] leading-tight shadow-[4px_4px_0_var(--af-ink)] sm:-right-5" style={{ ["--r" as string]: "1.5deg" }} aria-hidden="true">
        Medium print sold
        <b className="num block font-display text-[19px] text-earned [font-variation-settings:'wdth'_80]">+{money(perPrint)}</b>
      </div>
      <div className="af-float absolute -left-1 bottom-[15%] rounded-2xl border-2 border-ink bg-white px-3.5 py-2 text-[13px] leading-tight shadow-[4px_4px_0_var(--af-ink)] [animation-delay:-2.7s] sm:-left-6" style={{ ["--r" as string]: "-2deg" }} aria-hidden="true">
        Scanned at the café
        <b className="num block font-display text-[19px] text-scan [font-variation-settings:'wdth'_80]">14 scans today</b>
      </div>
      </div>
      <p className="mt-3 pl-1 text-[13px] text-ink-2">
        On the wall: <Link href={`/art/${art.slug}`} className="font-semibold text-ink no-underline hover:underline">{art.title}</Link> by{" "}
        <Link href={`/@${art.artist.slug}`} className="text-ink no-underline hover:underline">{art.artist.name}</Link>
      </p>
    </div>
  );
}
