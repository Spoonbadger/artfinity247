import Link from "next/link";
import { cn } from "@/lib/utils";

/** The mark: a frame with a square inside. A QR corner and a framed painting are the same shape. */
export function LogoMark({ className, inner = "var(--af-scan)" }: { className?: string; inner?: string }) {
  return (
    <svg className={cn("h-[1.05em] w-[1.05em] shrink-0", className)} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill={inner} />
    </svg>
  );
}

export default function Logo({ href = "/", className }: { href?: string | null; className?: string }) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5 font-display text-[23px] font-extrabold tracking-[-0.02em] text-ink [font-variation-settings:'wdth'_85]", className)}>
      <LogoMark />
      artfinity
    </span>
  );
  return href ? <Link href={href} aria-label="Artfinity home" className="no-underline">{inner}</Link> : inner;
}
