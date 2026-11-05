"use client";

// The one sort / filter control for Studio lists and grids. A small native select with an icon, so it works with
// a keyboard, a screen reader and a phone's own picker. Pair it with useSortPref to remember the last choice.
//
//   const [sort, setSort] = useSortPref("art.sort", "newest", SORTS.map((s) => s.value));
//   <SortMenu label="Sort" value={sort} onChange={setSort} options={SORTS} />
import { useEffect, useId, useState } from "react";
import { ArrowDownUp, ChevronDown, ListFilter, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption<T extends string = string> = { value: T; label: string };

export function SortMenu<T extends string>({
  label,
  value,
  onChange,
  options,
  kind = "sort",
  icon,
  className,
}: {
  /** Read by screen readers and shown as the tooltip: "Sort", "Show" */
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: SortOption<T>[];
  /** Picks the default icon: arrows for sort, a funnel for filter. */
  kind?: "sort" | "filter";
  icon?: LucideIcon;
  className?: string;
}) {
  const id = useId();
  const Icon = icon ?? (kind === "filter" ? ListFilter : ArrowDownUp);
  return (
    <div className={cn("relative inline-flex min-w-0", className)} title={label}>
      <label htmlFor={id} className="sr-only">{label}</label>
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="min-h-[40px] w-full min-w-0 appearance-none truncate rounded-full border-[1.5px] border-line bg-white py-1.5 pl-9 pr-8 text-[14px] font-semibold text-ink hover:border-ink focus-visible:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
    </div>
  );
}

/** A choice remembered in localStorage (per browser). Falls back to `fallback` when storage is off or the value is stale. */
export function useSortPref<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const storeKey = `af.sort.${key}`;
  const [value, setValue] = useState<T>(fallback);
  const allowedKey = allowed.join("|");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(storeKey) as T | null;
      if (v && allowedKey.split("|").includes(v)) setValue(v);
    } catch {
      /* private mode etc. */
    }
  }, [storeKey, allowedKey]);
  const set = (v: T) => {
    setValue(v);
    try {
      window.localStorage.setItem(storeKey, v);
    } catch {
      /* private mode etc. */
    }
  };
  return [value, set];
}
