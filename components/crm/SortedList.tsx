"use client";

// Sorts a server-rendered list in the browser and remembers the choice (SortMenu + useSortPref).
// Each item brings its own <li> and the values it can be sorted by, so the page keeps rendering rows on the server.
import { Fragment, type ReactNode, useMemo } from "react";
import { SortMenu, useSortPref } from "@/components/studio/SortMenu";

export type SortedItem = { id: string; sort: Record<string, string | number>; node: ReactNode };
/** by: which item.sort value to compare. desc: biggest / newest first. */
export type SortedOption = { value: string; label: string; by: string; desc?: boolean };

export default function SortedList({
  items,
  options,
  storageKey,
  toolbar,
  listClassName,
  listLabel,
}: {
  items: SortedItem[];
  options: SortedOption[];
  storageKey: string;
  /** Shown left of the sort menu: a heading or filter pills. */
  toolbar?: ReactNode;
  listClassName?: string;
  listLabel?: string;
}) {
  const [sort, setSort] = useSortPref(storageKey, options[0].value, options.map((o) => o.value));
  const opt = options.find((o) => o.value === sort) ?? options[0];
  const shown = useMemo(() => {
    const list = items.slice();
    list.sort((a, b) => {
      const x = a.sort[opt.by] ?? "";
      const y = b.sort[opt.by] ?? "";
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return opt.desc ? -c : c;
    });
    return list;
  }, [items, opt]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {toolbar}
        {items.length > 1 && <SortMenu label="Sort" value={opt.value} onChange={setSort} options={options} className="ml-auto" />}
      </div>
      <ul className={listClassName} aria-label={listLabel}>
        {shown.map((i) => <Fragment key={i.id}>{i.node}</Fragment>)}
      </ul>
    </>
  );
}
