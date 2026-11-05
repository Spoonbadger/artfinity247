"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_META, ago, pigmentFor, shortDate, usd, type Stage } from "./format";
import { EmptyState } from "@/components/studio/EmptyState";
import { SortMenu, useSortPref } from "@/components/studio/SortMenu";

export type CustomerRow = {
  email: string;
  href: string;
  masked: string;
  name: string;
  city: string;
  first: string;
  last: string;
  orders: number;
  prints: number;
  spentCents: number;
  stage: Stage;
  repeat: boolean;
  thumb: string | null;
  thumbTitle: string;
  pieces: string[];
};

const SORTS = [
  { value: "recent", label: "Most recent" },
  { value: "spend", label: "Most spent" },
  { value: "orders", label: "Most orders" },
  { value: "name", label: "A–Z" },
] as const;
type SortKey = (typeof SORTS)[number]["value"];
const SORT_KEYS = SORTS.map((s) => s.value);

const FILTERS = ["all", "waiting", "repeat"] as const;
type FilterKey = (typeof FILTERS)[number];

export function StageDot({ stage, className }: { stage: Stage; className?: string }) {
  const m = STAGE_META[stage];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-ink", className)}>
      <i className="paint-dab !h-3 !w-3" style={{ ["--dab" as string]: m.dab }} aria-hidden="true" />
      {m.label}
    </span>
  );
}

export function RepeatChip() {
  return <span className="inline-block -rotate-2 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-sticker px-2 py-px text-[11.5px] font-bold text-ink">Repeat buyer</span>;
}

function Thumb({ row, size = 48 }: { row: CustomerRow; size?: number }) {
  return row.thumb ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.thumb} alt={row.thumbTitle} width={size} height={size} className="shrink-0 rounded-[3px] object-cover shadow-[0_1px_0_var(--af-line)]" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-[3px] font-display text-lg font-extrabold text-ink" style={{ width: size, height: size, background: pigmentFor(row.email) }}>
      {row.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function CustomerList({ rows }: { rows: CustomerRow[] }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useSortPref<SortKey>("customers", "recent", SORT_KEYS);
  const [filter, setFilter] = useSortPref<FilterKey>("customers.show", "all", FILTERS);
  const waiting = rows.filter((r) => r.stage !== "delivered").length;
  const repeat = rows.filter((r) => r.repeat).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = needle
      ? rows.filter((r) => [r.name, r.city, r.email, ...r.pieces].some((s) => s.toLowerCase().includes(needle)))
      : rows.slice();
    if (filter === "waiting") list = list.filter((r) => r.stage !== "delivered");
    if (filter === "repeat") list = list.filter((r) => r.repeat);
    list.sort((a, b) =>
      sort === "orders" ? b.orders - a.orders || b.last.localeCompare(a.last)
        : sort === "spend" ? b.spentCents - a.spentCents || b.last.localeCompare(a.last)
          : sort === "name" ? a.name.localeCompare(b.name)
            : b.last.localeCompare(a.last)
    );
    return list;
  }, [rows, q, sort, filter]);

  return (
    <section aria-label="Customer list" className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-h-[46px] w-full items-center gap-2 rounded-xl border-2 border-ink bg-white px-3 focus-within:border-scan focus-within:shadow-[0_0_0_3px_#d9dcff] sm:max-w-[360px]">
          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="sr-only">Search customers</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, city or piece"
            className="w-full min-w-0 border-0 bg-transparent py-2 text-[16px] text-ink outline-none placeholder:text-ink-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <SortMenu
            kind="filter"
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `Everyone (${rows.length})` },
              { value: "waiting", label: `Waiting on a print (${waiting})` },
              { value: "repeat", label: `Repeat buyers (${repeat})` },
            ]}
          />
          <SortMenu label="Sort" value={sort} onChange={setSort} options={[...SORTS]} />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{shown.length} customers shown</p>

      {shown.length === 0 ? (
        q.trim() ? (
          <EmptyState
            compact
            title={`No customers match "${q.trim()}"`}
            body="Search covers names, cities and pieces. Try fewer letters."
            action={{ label: "Clear search", onClick: () => setQ("") }}
          />
        ) : (
          <EmptyState
            compact
            title={filter === "waiting" ? "Every print has arrived" : "No repeat buyers yet"}
            body={filter === "waiting" ? "Orders on their way show up here." : "A thank-you note helps bring people back."}
            action={{ label: "See everyone", onClick: () => setFilter("all") }}
          />
        )
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="grid gap-2.5 md:hidden">
            {shown.map((r) => (
              <li key={r.email}>
                <Link href={r.href} className="flex gap-3 rounded-2xl border border-line bg-white p-3 text-ink no-underline shadow-[0_2px_0_var(--af-line)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-scan active:bg-wall">
                  <Thumb row={r} size={56} />
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="flex items-start justify-between gap-2">
                      <b className="truncate text-[16px]">{r.name}</b>
                      <b className="num shrink-0 text-[15px]">{usd(r.spentCents)}</b>
                    </span>
                    <span className="truncate text-[13px] text-ink-2">
                      {[r.city, ago(r.last)].filter(Boolean).join(" · ")}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <StageDot stage={r.stage} />
                      <span className="num text-[13px] text-ink-2">{r.prints} {r.prints === 1 ? "print" : "prints"}</span>
                      {r.repeat && <RepeatChip />}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-hidden rounded-2xl border-[1.5px] border-ink bg-white md:block">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-line bg-wall text-left text-[12px] text-ink-2">
                  <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">City</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">First</th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Last</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Prints</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Spent</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Latest order</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.email} className="relative border-t border-line first:border-t-0 hover:bg-wall/70">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-3">
                        <Thumb row={r} size={40} />
                        <span className="grid min-w-0">
                          <span className="flex items-center gap-2">
                            <Link href={r.href} className="truncate font-bold text-ink no-underline after:absolute after:inset-0 hover:underline focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-scan">
                              {r.name}
                            </Link>
                            {r.repeat && <RepeatChip />}
                          </span>
                          <span className="text-[12.5px] text-ink-2">{r.masked}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{r.city}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5 text-ink-2">{shortDate(r.first, true)}</td>
                    <td className="num whitespace-nowrap px-3 py-2.5">{ago(r.last)}</td>
                    <td className="num px-3 py-2.5 text-right">{r.prints}</td>
                    <td className="num px-3 py-2.5 text-right font-semibold">{usd(r.spentCents)}</td>
                    <td className="px-4 py-2.5"><StageDot stage={r.stage} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
