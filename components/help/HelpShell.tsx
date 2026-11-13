import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { BrushStroke, Splotch } from "@/components/af/Brush";
import { HELP_SECTIONS } from "@/content/help/sections";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/about";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-ink-2">
        {items.map((c, i) => (
          <li key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            {c.href ? (
              <Link href={c.href} className="font-semibold text-ink-2 no-underline hover:text-ink hover:underline">{c.label}</Link>
            ) : (
              <span aria-current="page" className="truncate">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Section list with a splotch behind the current one (the LongForm look). */
export function SectionNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Help sections" className="grid gap-1 lg:sticky lg:top-24">
      <span className="eyebrow mb-2">Help sections</span>
      {HELP_SECTIONS.map((s) => {
        const on = current === s.id;
        return (
          <Link key={s.id} href={`/help/${s.id}`} aria-current={on ? "page" : undefined}
            className={cn("relative isolate flex items-center gap-2.5 px-3 py-2.5 text-[15px] no-underline md:py-1.5", on ? "font-bold text-ink" : "text-ink-2 hover:text-ink")}>
            {on && <Splotch className="absolute -inset-x-1 inset-y-0 -z-10 h-full w-[calc(100%+8px)]" />}
            <i className="paint-dab h-3 w-3" style={{ ["--dab" as string]: s.dab }} aria-hidden="true" />
            {s.title}
          </Link>
        );
      })}
      <span className="mt-4 text-[14px] text-ink-2">
        Still stuck? <Link href="/contact" className="font-semibold text-ink underline underline-offset-2">Message us</Link>
      </span>
    </nav>
  );
}

/** Header band shared by the help pages. */
export function HelpHeader({ title, sub, crumbs, children }: { title: ReactNode; sub?: ReactNode; crumbs?: Crumb[]; children?: ReactNode }) {
  return (
    <header className="relative overflow-hidden border-b border-line bg-wall">
      <BrushStroke className="pointer-events-none absolute -right-20 bottom-4 hidden h-14 w-[420px] -rotate-[4deg] opacity-40 md:block" color="var(--af-sticker)" />
      <div className="relative mx-auto max-w-[1240px] px-4 pb-10 pt-8 sm:px-6 md:pb-14 md:pt-14">
        {crumbs && <Breadcrumbs items={crumbs} />}
        <h1 className="display max-w-[20ch] text-[40px] sm:text-[60px]">{title}</h1>
        {sub && <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">{sub}</p>}
        {children}
      </div>
    </header>
  );
}

export function StillStuck() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-ink px-5 py-6 text-white sm:px-7">
      <BrushStroke className="pointer-events-none absolute -right-16 -top-2 h-10 w-[260px] -rotate-[6deg] opacity-30" color="var(--af-sticker)" />
      <h2 className="display relative text-[30px] text-white">Still stuck?</h2>
      <p className="relative mt-1 max-w-[52ch] text-[15.5px] text-white/80">We answer every message. Order problems: {COMPANY.supportEmail}.</p>
      <Link href="/contact" className="btn btn-sticker relative mt-4">Message us</Link>
    </section>
  );
}
