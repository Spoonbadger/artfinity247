"use client";

import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { UrlFilter, UrlSort } from "@/components/browse/UrlSort";
import { ART_SORTS, PRICE_BANDS, PRINT_SIZE_KEYS } from "@/components/browse/sortOptions";
import { SIZE_LABEL, sizeInches } from "@/components/art/pricing";

type City = { slug: string; label: string; pieces: number };

const PRICE_OPTIONS = [{ value: "", label: "Any price" }, ...PRICE_BANDS.map((b) => ({ value: b.value, label: b.label }))];
const SIZE_OPTIONS = [{ value: "", label: "Any size" }, ...PRINT_SIZE_KEYS.map((s) => ({ value: s, label: `${SIZE_LABEL[s]} (${sizeInches(s)})` }))];

/**
 * Search box (a plain GET form, so it works without JS) plus sort and filters, which live in the URL.
 * Neighborhoods are the chip row under the page title, so they aren't repeated here.
 * `cities` and `showCity` are kept for callers that pass them.
 */
export default function ArtFilters({
  action = "/art",
  q,
  placeholder = "Search art, artists, neighborhoods",
  storageKey = "browse.art",
  filters = false,
  artists = [],
}: {
  action?: string;
  q?: string;
  city?: string;
  sort?: string;
  cities?: City[];
  showCity?: boolean;
  placeholder?: string;
  storageKey?: string;
  /** Show price, size and artist filters. */
  filters?: boolean;
  artists?: { slug: string; name: string }[];
}) {
  const params = useSearchParams();
  // keep the other choices when the search changes
  const keep = Array.from(params.entries()).filter(([k]) => k !== "q" && k !== "page");
  return (
    <div className="grid w-full gap-2 md:w-auto md:justify-items-end">
      <form action={action} method="get" role="search" className="w-full md:w-80">
        {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="flex min-w-0 items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-2 focus-within:border-scan">
          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="sr-only">Search art</span>
          <input name="q" type="search" defaultValue={q} placeholder={placeholder} className="w-full min-w-0 border-0 bg-transparent p-0 py-1 text-[16px] text-ink outline-none placeholder:text-ink-2 md:py-0 md:text-[15px]" />
        </label>
      </form>
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:justify-end">
        <UrlSort storageKey={storageKey} options={ART_SORTS} fallback="newest" />
        {filters && (
          <>
            <UrlFilter param="price" label="Price" options={PRICE_OPTIONS} />
            <UrlFilter param="size" label="Print size" options={SIZE_OPTIONS} />
            {artists.length > 1 && <UrlFilter param="artist" label="Artist" options={[{ value: "", label: "Any artist" }, ...artists.map((a) => ({ value: a.slug, label: a.name }))]} />}
          </>
        )}
      </div>
    </div>
  );
}
