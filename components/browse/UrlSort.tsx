"use client";

// Sort and filter controls for the public, server-rendered lists (browse, artists, an artist's page, search).
// The choice lives in the URL (?sort=, ?price=…) so the server does the work and links can be shared.
// Sorts are also remembered in localStorage, with the same keys as the Studio's useSortPref.
import { useEffect, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SortMenu, type SortOption } from "@/components/studio/SortMenu";

const storeKey = (key: string) => `af.sort.${key}`;

function useSetParam(param: string) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  return (value: string, fallback: string) => {
    const next = new URLSearchParams(params.toString());
    if (value && value !== fallback) next.set(param, value);
    else next.delete(param);
    next.delete("page"); // a new order or filter starts at page 1
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
}

/** A sort select bound to ?sort= (or `param`), remembered per list under `storageKey`. */
export function UrlSort({ storageKey, options, fallback, param = "sort", label = "Sort", className }: {
  storageKey: string;
  options: SortOption[];
  fallback: string;
  param?: string;
  label?: string;
  className?: string;
}) {
  const params = useSearchParams();
  const setParam = useSetParam(param);
  const current = params.get(param);
  const value = current && options.some((o) => o.value === current) ? current : fallback;
  const allowed = options.map((o) => o.value).join("|");

  // No sort in the URL: bring back the one this browser picked last time.
  useEffect(() => {
    if (current) return;
    try {
      const saved = window.localStorage.getItem(storeKey(storageKey));
      if (saved && saved !== fallback && allowed.split("|").includes(saved)) setParam(saved, fallback);
    } catch {
      /* storage off */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, storageKey, fallback, allowed]);

  const change = (v: string) => {
    try {
      window.localStorage.setItem(storeKey(storageKey), v);
    } catch {
      /* storage off */
    }
    setParam(v, fallback);
  };
  return <SortMenu label={label} value={value} onChange={change} options={options} className={className} />;
}

/** A filter select bound to one URL param. "" (the first option, e.g. "Any price") clears it. Not remembered. */
export function UrlFilter({ param, label, options, className }: { param: string; label: string; options: SortOption[]; className?: string }) {
  const params = useSearchParams();
  const setParam = useSetParam(param);
  const current = params.get(param) ?? "";
  const value = options.some((o) => o.value === current) ? current : "";
  return <SortMenu kind="filter" label={label} value={value} onChange={(v) => setParam(v, "")} options={options} className={className} />;
}
