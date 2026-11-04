"use client";

import { useRef } from "react";
import { Search } from "lucide-react";

type City = { slug: string; label: string; pieces: number };

/** Plain GET form so it works without JS; selects submit on change. */
export default function ArtFilters({ action = "/art", q, city, sort, cities, showCity = true }: { action?: string; q?: string; city?: string; sort?: string; cities: City[]; showCity?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const submit = () => form.current?.requestSubmit();
  const select = "w-full min-w-0 cursor-pointer appearance-none rounded-full border-2 border-ink bg-white bg-[length:12px] bg-[right_14px_center] bg-no-repeat py-2 pl-4 pr-9 text-[15px] font-semibold text-ink outline-none focus-visible:border-scan";
  const chevron = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%2315161b' stroke-width='2'/%3E%3C/svg%3E\")" };
  return (
    <form ref={form} action={action} method="get" role="search" className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:items-center">
      <label className="col-span-2 flex min-w-0 items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 focus-within:border-scan md:w-72">
        <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
        <span className="sr-only">Search art</span>
        <input name="q" type="search" defaultValue={q} placeholder="Search art, artists, cities" className="w-full min-w-0 border-0 bg-transparent p-0 text-[15px] text-ink outline-none placeholder:text-ink-2" />
      </label>
      {showCity && (
        <label className="min-w-0">
          <span className="sr-only">City</span>
          <select name="city" defaultValue={city || ""} onChange={submit} className={select} style={chevron}>
            <option value="">All cities</option>
            {cities.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </label>
      )}
      <label className="min-w-0">
        <span className="sr-only">Sort</span>
        <select name="sort" defaultValue={sort || "newest"} onChange={submit} className={select} style={chevron}>
          <option value="newest">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </label>
      <button type="submit" className="sr-only">Apply</button>
    </form>
  );
}
