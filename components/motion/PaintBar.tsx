"use client";

import { cn } from "@/lib/utils";

export type PaintSeg = { label: string; value: number; color: string };

/**
 * A painted stacked bar whose segments glide when the values change.
 * Built from full-width layers scaled from the left (painter's order), so it animates
 * with transform only and never re-lays out. Decorative: pass the numbers in text too.
 */
export default function PaintBar({ segs, className, label }: { segs: PaintSeg[]; className?: string; label?: string }) {
  const total = segs.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const cum = segs.map((sg) => (acc += sg.value) / total);
  return (
    <div
      className={cn("relative h-14 w-full overflow-hidden", className)}
      style={{ borderRadius: "10px 16px 9px 14px / 16px 9px 14px 10px" }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {segs.map((sg, i) => (
        <div
          key={sg.label}
          className="absolute inset-0 origin-left transition-transform duration-700 ease-[cubic-bezier(.5,0,.2,1)] motion-reduce:transition-none"
          style={{ background: sg.color, transform: `scaleX(${cum[i]})`, zIndex: segs.length - i }}
        />
      ))}
      {cum.slice(0, -1).map((c, i) => (
        <div key={i} className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(.5,0,.2,1)] motion-reduce:transition-none" style={{ transform: `translateX(${c * 100}%)`, zIndex: segs.length + 1 }}>
          <span className="absolute inset-y-0 left-0 w-[3px] -translate-x-1/2 bg-white" />
        </div>
      ))}
      {/* brush texture on top */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: segs.length + 2 }} viewBox="0 0 300 56" preserveAspectRatio="none">
        <path d="M6 18c60-5 120-4 180-1s80 2 108 0" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".22" />
        <path d="M10 40c50 3 110 4 170 1s80-3 112-1" stroke="#000" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".06" />
      </svg>
    </div>
  );
}
