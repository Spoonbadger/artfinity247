// The one way to show "nothing here yet" in the Studio: say why it's empty and give the next step.
// Never leave a blank area: every list, table, chart and panel that can be empty renders this instead.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Action = { label: string; href: string } | { label: string; onClick: () => void };

function ActionButton({ action, primary }: { action: Action; primary?: boolean }) {
  const cls = cn("btn btn-sm", primary ? "btn-blue" : "btn-ghost");
  return "href" in action ? (
    <Link href={action.href} className={cls}>{action.label}</Link>
  ) : (
    <button type="button" onClick={action.onClick} className={cls}>{action.label}</button>
  );
}

export function EmptyState({
  title,
  body,
  action,
  secondary,
  help,
  dab = "var(--af-sticker)",
  compact = false,
  className,
  children,
}: {
  /** What's missing, in plain words: "No codes yet" */
  title: string;
  /** Why it matters or what will show here, one or two short lines */
  body?: ReactNode;
  /** The main next step: "Make your first code" */
  action?: Action;
  secondary?: Action;
  /** Link to the matching help article */
  help?: { label?: string; href: string };
  dab?: string;
  /** Smaller version for panels and cards */
  compact?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid justify-items-start gap-2 rounded-2xl border border-dashed border-line bg-wall/60",
        compact ? "p-4" : "p-6 sm:p-8",
        className,
      )}
    >
      <span className="paint-dab h-5 w-5" style={{ ["--dab" as string]: dab }} aria-hidden="true" />
      <p className={cn("t-card", compact && "text-[15.5px]")}>{title}</p>
      {body && <div className={cn("max-w-[56ch] text-ink-2", compact ? "text-[14px]" : "text-[15px]")}>{body}</div>}
      {children}
      {(action || secondary || help) && (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {action && <ActionButton action={action} primary />}
          {secondary && <ActionButton action={secondary} />}
          {help && (
            <Link href={help.href} className="text-[13.5px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">
              {help.label ?? "How this works"}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
