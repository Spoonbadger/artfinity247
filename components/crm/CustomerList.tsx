"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_META, ago, pigmentFor, shortDate, usd, type Stage } from "./format";
import { EmptyState } from "@/components/studio/EmptyState";

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
  { key: "recent", label: "Recent" },
  { key: "prints", label: "Most prints" },
  { key: "spend", label: "Top spend" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

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
  const [sort, setSort] = useState<SortKey>("recent");

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle
      ? rows.filter((r) => [r.name, r.city, r.email, ...r.pieces].some((s) => s.toLowerCase().includes(needle)))
      : rows.slice();
    list.sort((a, b) =>
      sort === "prints" ? b.prints - a.prints || b.last.localeCompare(a.last)
        : sort === "spend" ? b.spentCents - a.spentCents || b.last.localeCompare(a.last)
          : b.last.localeCompare(a.last)
    );
    return list;
  }, [rows, q, sort]);

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
        <div role="radiogroup" aria-label="Sort customers" className="flex gap-1 rounded-full border border-line bg-white p-1">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={sort === s.key}
              onClick={() => setSort(s.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-scan sm:flex-none",
                sort === s.key ? "bg-ink text-white" : "text-ink hover:bg-wall"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">{shown.length} customers shown</p>

      {shown.length === 0 ? (
        <EmptyState
          compact
          title={`No customers match "${q.trim()}"`}
          body="Search looks at names, cities and the pieces they bought. Try fewer letters, or clear it to see everyone."
          action={{ label: "Clear search", onClick: () => setQ("") }}
        />
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
