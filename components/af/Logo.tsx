import Link from "next/link";
import { cn } from "@/lib/utils";
import { LOCKUP_MARK_TRANSFORM, LOCKUP_VIEWBOX, MARK_A, MARK_PAINT, MARK_SWATCH, WORDMARK } from "@/lib/brand/mark";

/*
 * Artfinity logo: one flat-brush swatch of paint with a lowercase "a" knocked out, then the
 * "artfinity" wordmark (Bricolage Grotesque ExtraBold, outlined, painted i-dots).
 * The wordmark follows currentColor; the paint defaults to Scan Blue and can take any colour.
 * Static files (favicons, mono and dark versions, og-image) live in /public/brand.
 */

/** The mark alone. `inner` is the paint colour. `letter` fills the a (leave it out and the surface shows through). */
export function LogoMark({ className, inner = "var(--af-scan)", letter }: { className?: string; inner?: string; letter?: string }) {
  return (
    <svg className={cn("h-[1.05em] w-[1.05em] shrink-0", className)} viewBox="2 2 44 44" aria-hidden="true">
      {letter ? (
        <>
          <path fill={inner} d={MARK_SWATCH} />
          <path fill={letter} d={MARK_A} />
        </>
      ) : (
        <path fill={inner} d={MARK_PAINT} />
      )}
    </svg>
  );
}

/** Horizontal lockup. Height follows font-size (set text-[22px] etc. through className). */
export default function Logo({ href = "/", className, paint = "var(--af-scan)" }: { href?: string | null; className?: string; paint?: string }) {
  const inner = (
    <span className={cn("inline-flex items-center text-[23px] leading-none text-ink", className)}>
      <svg viewBox={LOCKUP_VIEWBOX} className="block h-[1.2em] w-auto" style={{ aspectRatio: LOCKUP_VIEWBOX.split(" ").slice(2).join(" / ") }} aria-hidden="true">
        <g transform={LOCKUP_MARK_TRANSFORM}>
          <path fill={paint} d={MARK_PAINT} />
        </g>
        <path fill="currentColor" d={WORDMARK} />
      </svg>
      {!href && <span className="sr-only">Artfinity</span>}
    </span>
  );
  return href ? <Link href={href} aria-label="Artfinity home" className="inline-flex no-underline">{inner}</Link> : inner;
}
