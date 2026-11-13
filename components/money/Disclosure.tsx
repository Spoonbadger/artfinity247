import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A collapsed card for secondary material ("How payouts work", charts). Closed by default. */
export default function Disclosure({ title, hint, children, className, id }: { title: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <details id={id} className={cn("af-card group scroll-mt-20 p-4 sm:p-5", className)}>
      <summary className="flex min-h-[40px] cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span className="t-card">{title}</span>
        {hint && <span className="ml-auto hidden text-right text-[13.5px] font-semibold text-ink-2 group-open:hidden sm:inline">{hint}</span>}
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-ink-2 transition group-open:rotate-180", !hint && "ml-auto", hint && "max-sm:ml-auto")} aria-hidden="true" />
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
