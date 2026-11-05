"use client";
// Sort and filter pickers for Studio lists (Money, Sales, Analytics, My purchases).
// The last choice is remembered per list in localStorage. A small local control until the shared
// components/studio/SortMenu.tsx lands; same job, so it can be swapped for it.
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = { value: string; label: string };

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

/** A labelled native select: works with a keyboard and screen readers, and stays 40px tall for thumbs. */
export function Picker({ label, value, options, onChange, icon = true, className }: { label: string; value: string; options: SortOption[]; onChange: (v: string) => void; icon?: boolean; className?: string }) {
  return (
    <label className={cn("relative inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-2 border-line bg-white pl-3 pr-2 text-[13.5px] font-semibold focus-within:border-ink hover:border-ink", className)}>
      {icon && <ArrowDownUp className="h-3.5 w-3.5 shrink-0 text-ink-2" aria-hidden="true" />}
      <span className="text-ink-2">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 cursor-pointer appearance-none bg-transparent pr-4 font-semibold text-ink outline-none">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg viewBox="0 0 12 12" className="pointer-events-none absolute right-2.5 h-3 w-3 text-ink-2" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </label>
  );
}

/** Client-side sort state that remembers the last choice. */
export function useStoredSort(storageKey: string, options: SortOption[], fallback = options[0].value) {
  const [value, setValue] = useState(fallback);
  useEffect(() => {
    const v = read(storageKey);
    if (v && options.some((o) => o.value === v)) setValue(v);
    // options are static per list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  const set = (v: string) => {
    setValue(v);
    write(storageKey, v);
  };
  return [value, set] as const;
}

/**
 * For server-rendered lists: the choice lives in the URL (?sort=…), so the server sorts.
 * With no choice in the URL, the remembered one is applied on load.
 */
export function UrlPicker({ param, label, options, value, storageKey, icon = true, className }: { param: string; label: string; options: SortOption[]; value: string; storageKey: string; icon?: boolean; className?: string }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const fallback = options[0].value;
  const go = (v: string, replace = false) => {
    const q = new URLSearchParams(params.toString());
    if (v === fallback) q.delete(param);
    else q.set(param, v);
    q.delete("all");
    const href = `${path}${q.toString() ? `?${q}` : ""}`;
    if (replace) router.replace(href, { scroll: false });
    else router.push(href, { scroll: false });
  };
  useEffect(() => {
    if (params.get(param)) return;
    const v = read(storageKey);
    if (v && v !== fallback && options.some((o) => o.value === v)) go(v, true);
    // run once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Picker
      label={label}
      value={value}
      options={options}
      icon={icon}
      className={className}
      onChange={(v) => {
        write(storageKey, v);
        go(v);
      }}
    />
  );
}

/**
 * Sorts server-rendered rows on the client. Each row brings its own sort keys, so the server can keep rendering
 * the row markup (details, links) and this only reorders it.
 */
export function SortedRows({ rows, options, storageKey, label = "Sort", toolbar, className }: {
  rows: { id: string; keys: Record<string, number | string>; node: ReactNode }[];
  options: (SortOption & { dir?: "asc" | "desc" })[];
  storageKey: string;
  label?: string;
  /** Extra things to the left of the picker, like a title. */
  toolbar?: ReactNode;
  className?: string;
}) {
  const [sort, setSort] = useStoredSort(storageKey, options);
  const sorted = useMemo(() => {
    const dir = options.find((o) => o.value === sort)?.dir ?? "desc";
    return rows.slice().sort((a, b) => {
      const x = a.keys[sort], y = b.keys[sort];
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return dir === "asc" ? c : -c;
    });
  }, [rows, sort, options]);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {toolbar}
        {rows.length > 1 && <Picker label={label} value={sort} options={options} onChange={setSort} />}
      </div>
      <div className={className}>{sorted.map((r) => <div key={r.id} className="contents">{r.node}</div>)}</div>
    </>
  );
}
