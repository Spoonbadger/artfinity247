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
      {note && <em className="mt-1.5 border-t border-dashed border-line px-1 pt-1.5 text-[13px] text-ink-2">{note}</em>}
    </div>
  );
}

/** An irregular paint splotch, used behind the current item in a menu. */
export function Splotch({ className, color = "var(--af-sticker)" }: { className?: string; color?: string }) {
  return (
    <svg className={cn("block", className)} style={{ color }} viewBox="0 0 220 60" preserveAspectRatio="none" aria-hidden="true">
      <path fill="currentColor" d="M14 9c22-7 58-3 88-6 31-3 67-4 96 3 14 4 21 13 17 24-3 9 2 17-6 23-12 8-42 4-70 5-30 1-61 4-92 1C24 57 6 52 4 40 2 31 9 26 6 19 4 13 7 11 14 9Z" />
      <path fill="currentColor" opacity=".55" d="M196 6c8-2 15 1 16 5 1 5-6 6-11 5-6-1-11-8-5-10ZM9 47c-5 1-8 5-5 8 3 2 8 0 9-3 1-3-1-6-4-5Z" />
      <path d="M24 22c40-6 100-2 166-4M28 40c50 3 110-1 160 2" stroke="#fff" strokeWidth="2.5" fill="none" opacity=".25" strokeLinecap="round" />
    </svg>
  );
}
