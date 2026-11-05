"use client";
// One way to sort and filter admin lists. Every admin table uses these so headers, filters and
// remembered choices behave the same everywhere.
//   - useTable: sort + search + status + date range, remembered per table in localStorage
//   - SortTh: a clickable <th> with aria-sort and an arrow
//   - TableToolbar: search box, status select, date range, "Clear"
//   - DataTable: a ready-made sortable, filterable table for server pages (cells are rendered on the server)
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";
export type Sort = { key: string; dir: SortDir } | null;
export type Sortable = string | number | null | undefined;

const PREFIX = "af-admin-table:";

function read<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}
function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* private window or storage blocked: the choice just isn't remembered */
  }
}

/** useState that remembers the last value for this table (per browser). Renders `initial` first, then the saved value. */
export function useStored<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const saved = read<T>(key);
    if (saved !== undefined) setValue(saved);
  }, [key]);
  const set = (v: T) => {
    setValue(v);
    write(key, v);
  };
  return [value, set];
}

function cmp(a: Sortable, b: Sortable): number {
  const an = a == null || a === "";
  const bn = b == null || b === "";
  if (an || bn) return an && bn ? 0 : an ? 1 : -1; // blanks last
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
}

/** Sort a copy of rows by one key. Blanks always go last. */
export function sortRows<T>(rows: T[], sort: Sort, get: (row: T, key: string) => Sortable): T[] {
  if (!sort) return rows;
  const m = sort.dir === "asc" ? 1 : -1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => {
      const a = get(x.r, sort.key);
      const b = get(y.r, sort.key);
      if (a == null || a === "" || b == null || b === "") return cmp(a, b) || x.i - y.i;
      return cmp(a, b) * m || x.i - y.i;
    })
    .map((x) => x.r);
}

export type TableFilters = { q: string; status: string; from: string; to: string };
const NO_FILTERS: TableFilters = { q: "", status: "", from: "", to: "" };

/**
 * Sort and filter state for one table, remembered in localStorage under `id`.
 * Numbers and dates sort newest/biggest first on the first click; text sorts A→Z.
 */
export function useTable(id: string, opts: { sort?: Sort; status?: string } = {}) {
  const initial = { sort: opts.sort ?? null, filters: { ...NO_FILTERS, status: opts.status ?? "" } };
  const [state, setState] = useStored<{ sort: Sort; filters: TableFilters }>(id, initial);
  const sort = state.sort;
  const filters = { ...NO_FILTERS, ...state.filters };
  const setSort = (s: Sort) => setState({ sort: s, filters });
  const toggleSort = (key: string, firstDir: SortDir = "asc") => {
    if (sort?.key !== key) return setSort({ key, dir: firstDir });
    setSort({ key, dir: sort.dir === "asc" ? "desc" : "asc" });
  };
  const setFilter = (p: Partial<TableFilters>) => setState({ sort, filters: { ...filters, ...p } });
  const clear = () => setState({ sort, filters: { ...NO_FILTERS, status: opts.status ?? "" } });
  const active = !!(filters.q || (filters.status && filters.status !== (opts.status ?? "")) || filters.from || filters.to);
  return { sort, toggleSort, setSort, filters, setFilter, clear, active };
}

/** True when the row passes the search text, status and date range. `date` is an ISO string. */
export function passes(f: TableFilters, row: { search?: string; status?: string; date?: string | null }) {
  if (f.q && !(row.search ?? "").toLowerCase().includes(f.q.trim().toLowerCase())) return false;
  if (f.status && row.status !== undefined && row.status !== f.status) return false;
  if ((f.from || f.to) && row.date !== undefined) {
    if (!row.date) return false;
    const d = row.date.slice(0, 10);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
  }
  return true;
}

function Arrow({ dir }: { dir?: SortDir }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 10 12" className={cn("h-3 w-2.5 shrink-0", dir ? "text-ink" : "text-ink-2/50")}>
      <path d="M5 1.5 8 5H2z" fill="currentColor" opacity={dir === "desc" ? 0.25 : 1} />
      <path d="M5 10.5 2 7h6z" fill="currentColor" opacity={dir === "asc" ? 0.25 : 1} />
    </svg>
  );
}

/** Header cell that sorts its column. `firstDir` is the direction of the first click (desc for numbers and dates). */
export function SortTh({
  k, label, sort, onSort, align = "left", firstDir, className,
}: {
  k: string;
  label: ReactNode;
  sort: Sort;
  onSort: (key: string, firstDir?: SortDir) => void;
  align?: "left" | "right";
  firstDir?: SortDir;
  className?: string;
}) {
  const on = sort?.key === k ? sort.dir : undefined;
  return (
    <th scope="col" aria-sort={on === "asc" ? "ascending" : on === "desc" ? "descending" : "none"} className={cn("px-3 py-2 font-bold", align === "right" ? "text-right" : "text-left", className)}>
      <button
        type="button"
        onClick={() => onSort(k, firstDir ?? (align === "right" ? "desc" : "asc"))}
        className={cn("-mx-1 inline-flex min-h-[32px] items-center gap-1 rounded px-1 uppercase tracking-[0.06em] hover:text-ink", align === "right" && "flex-row-reverse", on && "text-ink")}
      >
        {label}
        <Arrow dir={on} />
      </button>
    </th>
  );
}

/** Plain header cell, same look as SortTh. */
export function Th({ children, align = "left", className }: { children?: ReactNode; align?: "left" | "right"; className?: string }) {
  return <th scope="col" className={cn("px-3 py-2 font-bold uppercase tracking-[0.06em]", align === "right" ? "text-right" : "text-left", className)}>{children}</th>;
}

/** For card lists (no column headers): a "Sort" select over the same sort state. */
export function SortSelect({ options, sort, onChange, className }: { options: { key: string; dir: SortDir; label: string }[]; sort: Sort; onChange: (s: Sort) => void; className?: string }) {
  const value = sort ? `${sort.key}:${sort.dir}` : "";
  return (
    <label className={cn("inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2", className)}>
      Sort
      <select
        value={value}
        onChange={(e) => {
          const [key, dir] = e.target.value.split(":");
          onChange(key ? { key, dir: dir as SortDir } : null);
        }}
        className="min-h-[40px] cursor-pointer rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] font-semibold text-ink hover:border-ink"
      >
        {options.map((o) => <option key={`${o.key}:${o.dir}`} value={`${o.key}:${o.dir}`}>{o.label}</option>)}
      </select>
    </label>
  );
}

const field = "min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2.5 text-[14px] text-ink hover:border-ink focus:border-scan";

/** Search, status and date filters above a table. Leave out a prop to leave out that filter. */
export function TableToolbar({
  filters, setFilter, clear, active, search, statuses, statusLabel = "Status", dates, count, total, children,
}: {
  filters: TableFilters;
  setFilter: (p: Partial<TableFilters>) => void;
  clear?: () => void;
  active?: boolean;
  /** Placeholder for the search box. */
  search?: string;
  statuses?: { value: string; label: string }[];
  statusLabel?: string;
  dates?: boolean;
  count?: number;
  total?: number;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const extra = !!statuses || !!dates;
  const extraOn = !!((filters.status) || filters.from || filters.to);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {search !== undefined && (
        <label className="relative min-w-[160px] flex-1 sm:max-w-[280px]">
          <span className="sr-only">Search</span>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" value={filters.q} onChange={(e) => setFilter({ q: e.target.value })} placeholder={search} className={cn(field, "w-full pl-8")} />
        </label>
      )}
      {extra && (
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={cn(field, "inline-flex items-center gap-1.5 font-semibold sm:hidden", extraOn && "border-ink")}>
          Filters{extraOn ? " •" : ""}
        </button>
      )}
      {extra && (
        <div className={cn("w-full flex-wrap items-center gap-2 sm:flex sm:w-auto", open ? "flex" : "hidden")}>
          {statuses && (
            <label className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              {statusLabel}
              <select value={filters.status} onChange={(e) => setFilter({ status: e.target.value })} className={cn(field, "cursor-pointer font-semibold")}>
                <option value="">All</option>
                {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          )}
          {dates && (
            <div className="inline-flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-ink-2">
              <label className="inline-flex items-center gap-1.5">From<input type="date" value={filters.from} onChange={(e) => setFilter({ from: e.target.value })} className={field} /></label>
              <label className="inline-flex items-center gap-1.5">to<input type="date" value={filters.to} onChange={(e) => setFilter({ to: e.target.value })} className={field} /></label>
            </div>
          )}
        </div>
      )}
      {children}
      {active && clear && <button type="button" onClick={clear} className="min-h-[40px] px-1 text-[13px] font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">Clear filters</button>}
      {count != null && total != null && count !== total && <span className="num ml-auto text-[13px] text-ink-2">{count} of {total}</span>}
    </div>
  );
}

export type Column = {
  key: string;
  label: ReactNode;
  align?: "left" | "right";
  /** Default true. */
  sortable?: boolean;
  /** First click direction; defaults to desc for right-aligned (number) columns. */
  firstDir?: SortDir;
  className?: string;
};
export type Row = {
  id: string;
  cells: Record<string, ReactNode>;
  /** Sort values by column key; columns without one aren't sortable. */
  sort?: Record<string, Sortable>;
  search?: string;
  status?: string;
  /** ISO date used by the date-range filter. */
  date?: string | null;
  className?: string;
};

/**
 * A sortable, filterable table for server pages. Cells are rendered on the server and passed in;
 * sort values and filter fields ride along on each row.
 */
export function DataTable({
  id, columns, rows, defaultSort, search, statuses, statusLabel, dates, empty, caption, minWidth = 560, toolbarExtra,
}: {
  /** Storage key for the remembered sort and filters. */
  id: string;
  columns: Column[];
  rows: Row[];
  defaultSort?: Sort;
  search?: string;
  statuses?: { value: string; label: string }[];
  statusLabel?: string;
  dates?: boolean;
  empty?: ReactNode;
  caption?: string;
  minWidth?: number;
  toolbarExtra?: ReactNode;
}) {
  const t = useTable(id, { sort: defaultSort ?? null });
  const shown = useMemo(
    () => sortRows(rows.filter((r) => passes(t.filters, r)), t.sort, (r, k) => r.sort?.[k]),
    [rows, t.filters, t.sort],
  );
  const hasToolbar = search !== undefined || !!statuses || dates || toolbarExtra;
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
      {hasToolbar && rows.length > 0 && (
        <TableToolbar filters={t.filters} setFilter={t.setFilter} clear={t.clear} active={t.active} search={search} statuses={statuses} statusLabel={statusLabel} dates={dates} count={shown.length} total={rows.length}>
          {toolbarExtra}
        </TableToolbar>
      )}
      {rows.length === 0 ? (
        empty ?? null
      ) : (
        <div className="relative overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="num w-full text-[14px]" style={{ minWidth }}>
            {caption && <caption className="sr-only">{caption}</caption>}
            <thead className="border-b border-line bg-wall/60 text-[12px] text-ink-2">
              <tr>
                {columns.map((c) =>
                  c.sortable === false || !rows.some((r) => r.sort && c.key in r.sort) ? (
                    <Th key={c.key} align={c.align} className={c.className}>{c.label}</Th>
                  ) : (
                    <SortTh key={c.key} k={c.key} label={c.label} sort={t.sort} onSort={t.toggleSort} align={c.align} firstDir={c.firstDir} className={c.className} />
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-ink-2">
                    Nothing matches. <button type="button" onClick={t.clear} className="font-semibold text-scan underline underline-offset-2">Clear filters</button>
                  </td>
                </tr>
              ) : (
                shown.map((r) => (
                  <tr key={r.id} className={cn("border-b border-line align-middle last:border-b-0", r.className)}>
                    {columns.map((c) => (
                      <td key={c.key} className={cn("px-3 py-2.5", c.align === "right" && "whitespace-nowrap text-right", c.className)}>{r.cells[c.key]}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
