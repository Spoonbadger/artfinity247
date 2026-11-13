// Inline notice for a problem or a blocker, always with the way to fix it.
// Use for things like "Confirm your email to get paid" or "This file is too small for XL".
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  error: "border-coral/50 bg-coral/10",
  warning: "border-sticker bg-sticker/20",
  info: "border-scan/30 bg-scan-soft",
  success: "border-earned/40 bg-earned-soft",
} as const;

export function Problem({
  tone = "warning",
  title,
  children,
  fix,
  secondary,
  className,
}: {
  tone?: keyof typeof TONES;
  title: string;
  children?: ReactNode;
  /** The button or link that resolves it. Required for errors and warnings: a problem without a fix is a dead end. */
  fix?: { label: string; href?: string; onClick?: () => void };
  /** A second way out, e.g. "Book a scan" next to "Pick a bigger file". */
  secondary?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3", TONES[tone], className)}>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {children && <div className="t-small">{children}</div>}
      </div>
      {(fix || secondary) && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {[fix, secondary].map((f, i) =>
            !f ? null : f.href ? (
              <Link key={i} href={f.href} className={i ? "btn btn-ghost btn-sm shrink-0" : "btn btn-sm shrink-0"}>{f.label}</Link>
            ) : (
              <button key={i} type="button" onClick={f.onClick} className={i ? "btn btn-ghost btn-sm shrink-0" : "btn btn-sm shrink-0"}>{f.label}</button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
