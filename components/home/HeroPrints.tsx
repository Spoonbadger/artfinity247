import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { artPath } from "@/lib/urls";

type Print = { slug: string; handle: string; title: string; imageUrl: string; artist: string };

/**
 * Phones: a row of real best-selling prints right under the sign-up, so buyers see art on the first screen and
 * are one tap from a print. Swipes sideways and ends on "Shop prints".
 */
export default function HeroPrints({ prints, className }: { prints: Print[]; className?: string }) {
  if (!prints.length) return null;
  return (
    <nav aria-label="Popular prints" className={className}>
      <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {prints.map((p) => (
          <li key={p.slug} className="shrink-0 snap-start">
            <Link href={artPath(p.handle, p.slug)} aria-label={`${p.title} by ${p.artist}`} className="block w-[116px] no-underline">
              <span className="block aspect-[4/5] overflow-hidden rounded-md bg-wall">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              </span>
            </Link>
          </li>
        ))}
        <li className="shrink-0 snap-start">
          <Link href="/art" className="grid aspect-[4/5] w-[116px] place-content-center justify-items-center gap-1.5 rounded-md border-[1.5px] border-edge-strong bg-white text-center text-[14px] font-bold text-ink no-underline">
            Shop prints
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
