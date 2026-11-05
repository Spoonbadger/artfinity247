// Shared admin building blocks: the page header and status pills. Server-safe (no hooks).
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Title, an optional one-line sub (12 words max), and at most one primary action on the right. */
export function PageHead({ title, sub, action, back, children }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <div className="grid gap-2">
      {back && <Link href={back.href} className="justify-self-start text-[13.5px] font-semibold text-ink-2 no-underline hover:text-ink">← {back.label}</Link>}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="display break-words text-[36px] sm:text-[44px]">{title}</h1>
          {sub && <p className="mt-1 text-[14px] text-ink-2">{sub}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export type Tone = "red" | "amber" | "green" | "blue" | "grey" | "ink";
const TONE: Record<Tone, string> = {
  red: "bg-coral/15 text-coral",
  amber: "bg-sticker/60 text-ink",
  green: "bg-earned-soft text-earned",
  blue: "bg-scan-soft text-scan",
  grey: "bg-wall text-ink-2 ring-1 ring-inset ring-line",
  ink: "bg-ink text-white",
};

/** The one status pill. Same size and shape on every admin page. */
export function Pill({ tone = "grey", children, title, className }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return <span title={title} className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-px text-[12px] font-bold leading-[18px]", TONE[tone], className)}>{children}</span>;
}

/** Common statuses mapped to one tone each, so "paid" or "pending" look the same everywhere. */
const STATUS_TONE: Record<string, Tone> = {
  urgent: "red", failed: "red", rejected: "red", refunded: "red", open: "amber", pending: "amber", flagged: "amber", held: "amber",
  normal: "amber", low: "grey", snoozed: "grey", closed: "grey", dismissed: "grey", draft: "grey", skipped: "grey",
  paid: "green", approved: "green", verified: "green", delivered: "green", resolved: "green", sent: "green", ok: "green", success: "green", published: "green", active: "green", posted: "green",
  shipped: "blue", scheduled: "blue", running: "blue", queued: "blue", processing: "blue",
};
export function StatusPill({ status, label, title }: { status: string; label?: ReactNode; title?: string }) {
  const s = (status || "").toLowerCase();
  return <Pill tone={STATUS_TONE[s] ?? "grey"} title={title}>{label ?? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}</Pill>;
}

/** A small titled card. */
export function Panel({ title, action, children, className, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("af-panel grid content-start gap-3 p-4 sm:p-5", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          {title && <h2 className="text-[18px] font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
