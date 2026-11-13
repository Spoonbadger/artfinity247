"use client";
// Sort and filter pickers for Studio lists (Money, Sales, Analytics, My purchases).
// The last choice is remembered per list in localStorage. The control itself is the shared SortMenu; this adds
// URL-driven sorting for server-rendered pages and client-side reordering of server-rendered rows.
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SortMenu } from "@/components/studio/SortMenu";

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

/** The shared Studio sort control (components/studio/SortMenu.tsx). `icon={false}` marks a filter, not a sort. */
export function Picker({ label, value, options, onChange, icon = true, className }: { label: string; value: string; options: SortOption[]; onChange: (v: string) => void; icon?: boolean; className?: string }) {
  return <SortMenu label={label} value={value} options={options} onChange={onChange} kind={icon ? "sort" : "filter"} className={className} />;
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
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      if (params.get(param)) return;
      const v = read(storageKey);
      if (v && v !== fallback && options.some((o) => o.value === v)) go(v, true);
      return;
    }
    // Changed by a link (like "Clear"): remember that too.
    write(storageKey, value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
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
export function SortedRows({ rows, options, storageKey, label = "Sort", toolbar, head, className }: {
  rows: { id: string; keys: Record<string, number | string>; node: ReactNode }[];
  options: (SortOption & { dir?: "asc" | "desc" })[];
  storageKey: string;
  label?: string;
  /** Extra things to the left of the picker, like a title. */
  toolbar?: ReactNode;
  /** Rendered above the rows, inside the list (column headings). */
  head?: ReactNode;
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
      <div className={className}>
        {head}
        {sorted.map((r) => <Fragment key={r.id}>{r.node}</Fragment>)}
      </div>
    </>
  );
}
