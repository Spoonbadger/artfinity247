"use client";
// Small "Sort: Newest ▾" pill + menu for buyer-facing lists. Remembers the last choice per list in localStorage.
// (Local stand-in until a shared sort control exists; same look: a pill button and a short menu.)
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption<K extends string> = { key: K; label: string };

/** The saved choice for `storageKey`, if it's still one of `keys`. */
export function useSavedSort<K extends string>(storageKey: string, keys: readonly K[], fallback: K) {
  const [value, setValue] = useState<K>(fallback);
  useEffect(() => {
    try {
      const v = localStorage.getItem(`af-sort:${storageKey}`) as K | null;
      if (v && keys.includes(v)) setValue(v);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const set = (v: K) => {
    setValue(v);
    try { localStorage.setItem(`af-sort:${storageKey}`, v); } catch {}
  };
  return [value, set] as const;
}

export default function SortPill<K extends string>({ options, value, onChange, label = "Sort", className }: {
  options: SortOption<K>[];
  value: K;
  onChange: (k: K) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  return (
    <div ref={box} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] border-line bg-white px-3.5 text-[14px] font-semibold text-ink hover:border-ink-2"
      >
        <ArrowUpDown className="h-4 w-4 text-ink-2" aria-hidden />
        <span className="text-ink-2">{label}:</span> {current.label}
      </button>
      {open && (
        <ul id={id} role="menu" className="absolute right-0 z-20 mt-1.5 grid min-w-[190px] gap-0.5 rounded-xl border border-line bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(21,22,27,.35)]">
          {options.map((o) => (
            <li key={o.key} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={o.key === value}
                onClick={() => { onChange(o.key); setOpen(false); }}
                className="flex min-h-[40px] w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-[14px] font-semibold text-ink hover:bg-wall"
              >
                {o.label}
                {o.key === value && <Check className="h-4 w-4" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
