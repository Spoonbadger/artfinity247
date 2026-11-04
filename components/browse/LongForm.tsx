import { ReactNode } from "react";
import Link from "next/link";
import { BrushStroke } from "@/components/af/Brush";
import { DabRow } from "./PageHead";
import { cn } from "@/lib/utils";

const POLICIES: [string, string][] = [
  ["Sell with us", "/sell-with-us"],
  ["Artist terms", "/artist-terms-and-agreement"],
  ["Terms and conditions", "/terms-and-conditions"],
  ["Privacy policy", "/privacy-policy"],
  ["Cookie policy", "/cookie-policy"],
  ["Return policy", "/return-policy"],
];

/** Readable long-form typography for policy text (works on raw HTML and JSX alike). */
export const PROSE = cn(
  "max-w-[68ch] text-[17px] leading-[1.7] text-ink [overflow-wrap:anywhere]",
  "[&_h2]:mb-3 [&_h2]:mt-12 [&_h2]:font-display [&_h2]:text-[28px] [&_h2]:font-extrabold [&_h2]:leading-[1.05] [&_h2]:[font-variation-settings:'wdth'_80]",
  "[&_h3]:mb-2 [&_h3]:mt-8 [&_h3]:text-[19px] [&_h3]:font-bold",
  "[&_h4]:!mb-3 [&_h4]:mt-12 [&_h4]:font-display [&_h4]:text-[28px] [&_h4]:font-extrabold [&_h4]:leading-[1.05] [&_h4]:[font-variation-settings:'wdth'_80]",
  "[&_div>br:first-child]:hidden [&>div>div:first-child>h4]:mt-0 [&>section>div:first-child>h2]:mt-0 [&>div:first-child>h2:first-child]:mt-0",
  "[&_p]:my-3.5 [&_p]:text-[17px] [&_p]:leading-[1.7]",
  "[&_ul]:my-3.5 [&_ul]:ml-0 [&_ul]:list-none [&_ul]:space-y-2 [&_ul]:pl-0 [&_ol]:my-3.5 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_ul>li]:relative [&_ul>li]:pl-6 [&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.6em] [&_ul>li]:before:h-2.5 [&_ul>li]:before:w-2.5 [&_ul>li]:before:rotate-[-14deg] [&_ul>li]:before:rounded-[52%_44%_58%_40%] [&_ul>li]:before:bg-scan [&_ul>li]:before:content-['']",
  "[&_a]:font-semibold [&_a]:text-scan [&_a]:underline [&_a]:underline-offset-2",
  "[&_strong]:font-bold",
);

/** Shell for legal and info pages: title block, a side list of the other policies, readable column. */
export default function LongForm({ eyebrow, title, sub, children, current }: { eyebrow?: string; title: string; sub?: ReactNode; children: ReactNode; current?: string }) {
  return (
    <div className="pb-24">
      <header className="relative overflow-hidden border-b border-line bg-wall">
        <BrushStroke className="pointer-events-none absolute -right-20 bottom-4 h-14 w-[420px] -rotate-[4deg] opacity-40" color="var(--af-sticker)" />
        <div className="relative mx-auto max-w-[1240px] px-4 pb-10 pt-10 sm:px-6 md:pb-14 md:pt-16">
          <div className="mb-3 flex items-center gap-2.5"><DabRow /><span className="eyebrow">{eyebrow || "Artfinity"}</span></div>
          <h1 className="display max-w-[16ch] text-[44px] sm:text-[64px]">{title}</h1>
          {sub && <p className="mt-3 max-w-[56ch] text-[16px] text-ink-2">{sub}</p>}
        </div>
      </header>
      <div className="mx-auto grid max-w-[1240px] gap-10 px-4 pt-10 sm:px-6 md:pt-14 lg:grid-cols-[220px_1fr] lg:gap-16">
        <nav aria-label="Policies" className="order-last lg:order-first">
          <div className="grid gap-1 lg:sticky lg:top-24">
            <span className="eyebrow mb-2">Policies</span>
            {POLICIES.map(([label, href]) => (
              <Link key={href} href={href} aria-current={current === href ? "page" : undefined}
                className={cn("rounded-lg px-2 py-1.5 text-[15px] no-underline", current === href ? "bg-white font-bold text-ink shadow-[inset_3px_0_0_var(--af-scan)]" : "text-ink-2 hover:text-ink")}>
                {label}
              </Link>
            ))}
            <span className="mt-4 text-[14px] text-ink-2">Questions? <a href="mailto:support@theartfinity.com" className="font-semibold text-ink">support@theartfinity.com</a></span>
          </div>
        </nav>
        <article className={PROSE}>{children}</article>
      </div>
    </div>
  );
}

/** Policy page from stored HTML (db/json/AppPages.json); text unchanged. */
export function HtmlPolicy({ title, sub, html, current }: { title: string; sub?: string; html: string; current: string }) {
  return (
    <LongForm eyebrow="Policy" title={title} sub={sub ? sub.charAt(0) + sub.slice(1).toLowerCase() : undefined} current={current}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </LongForm>
  );
}
