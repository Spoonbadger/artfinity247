import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A hand-painted stroke. Size it with className; color with `color`. */
export function BrushStroke({ className, color = "var(--af-sticker)", style }: { className?: string; color?: string; style?: CSSProperties }) {
  return (
    <svg className={cn("block", className)} style={{ color, ...style }} viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
      <use href="#af-stroke" />
    </svg>
  );
}

/** Wraps a word with a brush stroke underneath it. Use once per screen at most. */
export function Brushed({ children, color = "var(--af-sticker)" }: { children: ReactNode; color?: string }) {
  return (
    <span className="relative z-0 whitespace-nowrap">
      {children}
      <BrushStroke className="absolute -bottom-[0.04em] -left-2 -z-10 h-[0.5em] w-[calc(100%+16px)]" color={color} />
    </span>
  );
}

/** A brushed paint swatch, used at the top of paint-chip stat cards. */
export function Swatch({ color, className }: { color: string; className?: string }) {
  return (
    <svg className={cn("block h-14 w-full", className)} style={{ color }} viewBox="0 0 200 70" preserveAspectRatio="none" aria-hidden="true">
      <use href="#af-swatch" />
    </svg>
  );
}

/** A paint-chip stat card: swatch, big number, label, pigment note. */
export function PaintChip({ color, value, label, note, earned = false }: { color: string; value: ReactNode; label: string; note?: string; earned?: boolean }) {
  return (
    <div className="grid min-w-0 gap-0.5 rounded-[3px] border border-line bg-white p-2 pb-3 shadow-[0_2px_0_var(--af-line)]">
      <Swatch color={color} className="mb-2" />
      <b className={cn("display num px-1 text-[30px] [overflow-wrap:anywhere]", earned ? "text-earned" : "text-ink")}>{value}</b>
      <span className="px-1 text-[13px] text-ink-2">{label}</span>
      {note && <em className="mt-1.5 border-t border-dashed border-line px-1 pt-1.5 text-[11.5px] text-ink-2">{note}</em>}
    </div>
  );
}
