import { ReactNode } from "react";
import Link from "next/link";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";

/** A loose row of paint dabs, like testing colors on the edge of a canvas. */
export function DabRow({ colors = ["var(--af-scan)", "var(--af-sticker)", "var(--af-coral)", "var(--af-ink)"], className }: { colors?: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} aria-hidden="true">
      {colors.map((c, i) => (
        <span key={i} className="paint-dab" style={{ ["--dab" as string]: c, transform: `rotate(${[-14, 22, -38, 8][i % 4]}deg) scale(${[1, 0.8, 1.1, 0.7][i % 4]})` }} />
      ))}
    </span>
  );
}

/** Page title block for browse and info pages: short eyebrow, big narrow headline, one line under it. */
export default function PageHead({ eyebrow, title, sub, children, className, stroke = "var(--af-sticker)" }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; children?: ReactNode; className?: string; stroke?: string }) {
  return (
    <header className={cn("relative mx-auto max-w-[1240px] px-4 pb-6 pt-10 sm:px-6 md:pb-8 md:pt-14", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          {eyebrow && <div className="mb-3 flex items-center gap-2.5"><DabRow /><span className="eyebrow">{eyebrow}</span></div>}
          <h1 className="display relative inline-block text-[44px] sm:text-[64px] md:text-[76px]">
            <span className="relative z-10">{title}</span>
            <BrushStroke className="absolute -bottom-1 left-0 z-0 h-[0.32em] w-[min(100%,5.5em)] opacity-90" color={stroke} />
          </h1>
          {sub && <p className="mt-3 max-w-[46ch] text-[17px] text-ink-2">{sub}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="mt-12 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pages">
      {page > 1 && <Link href={href(page - 1)} className="btn btn-ghost btn-sm" rel="prev">Previous</Link>}
      {nums.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-ink-2">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={cn("num grid h-9 min-w-9 place-items-center rounded-full px-2 text-[14px] font-semibold no-underline", n === page ? "bg-ink text-white" : "text-ink hover:bg-wall")}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className="btn btn-ghost btn-sm" rel="next">Next</Link>}
    </nav>
  );
}

/** Empty state: a blank canvas on the wall. */
export function EmptyCanvas({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
      <div className="relative h-36 w-28 rounded-[2px] border-[6px] border-white bg-[#fbfaf6] shadow-[0_14px_28px_-10px_rgba(21,22,27,.35)]" aria-hidden="true">
        <BrushStroke className="absolute left-2 top-10 h-4 w-16 -rotate-6" color="var(--af-line)" />
        <span className="paint-dab absolute bottom-4 right-3" style={{ ["--dab" as string]: "var(--af-sticker)" }} />
      </div>
      <h2 className="display text-[32px]">{title}</h2>
      {children}
    </div>
  );
}
