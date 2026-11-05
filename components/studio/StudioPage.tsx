import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard page frame for Studio pages: padding, max width, header row.
 * PAGE_RULES: a title, at most one short `sub` line (12 words or fewer), and at most one `btn-blue` in `actions`.
 */
export function StudioPage({ title, sub, actions, children, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto grid max-w-[1320px] gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="display text-[clamp(34px,5vw,50px)]">{title}</h1>
          {sub && <p className="mt-1.5 max-w-[60ch] text-[14px] text-ink-2">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
