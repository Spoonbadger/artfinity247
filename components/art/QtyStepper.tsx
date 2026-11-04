"use client";

import { Minus, Plus } from "lucide-react";

/** Compact "− 1 +" quantity control. max respects limited editions (prints left). */
export default function QtyStepper({ value, onChange, max = 10, min = 1, label = "Quantity" }: { value: number; onChange: (n: number) => void; max?: number; min?: number; label?: string }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const btn = "grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-wall disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan";
  return (
    <div className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-white p-0.5" role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label="One fewer">
        <Minus className="h-4 w-4" aria-hidden />
      </button>
      <output className="num min-w-[2ch] text-center text-[17px] font-bold" aria-live="polite" aria-label={`${label}: ${value}`}>{value}</output>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="One more">
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
