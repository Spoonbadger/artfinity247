"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

/** − [12] + with typing. Steps of 1; clamps to 1..max on blur. */
export default function QtyInput({ value, onChange, max, label }: { value: number; onChange: (n: number) => void; max: number; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (n: number) => Math.max(1, Math.min(max, Math.round(n) || 1));
  const btn = "grid h-9 w-9 place-items-center rounded-full hover:bg-wall disabled:opacity-30 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan";
  return (
    <div className="inline-flex items-center rounded-full border-2 border-ink bg-white p-0.5">
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= 1} aria-label="One fewer"><Minus className="h-4 w-4" aria-hidden /></button>
      <input
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9]/g, "").slice(0, 3);
          setText(t);
          if (t) onChange(clamp(parseInt(t, 10)));
        }}
        onBlur={() => setText(String(clamp(parseInt(text, 10))))}
        className="num w-10 bg-transparent text-center text-[16px] font-bold outline-none"
      />
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label="One more"><Plus className="h-4 w-4" aria-hidden /></button>
    </div>
  );
}
