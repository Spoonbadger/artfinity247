import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Standard page frame for Studio pages: padding, max width, header row. */
export function StudioPage({ title, sub, actions, children, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto grid max-w-[1320px] gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="display text-[clamp(34px,5vw,50px)]">{title}</h1>
          {sub && <p className="mt-2 text-[14px] text-ink-2">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
