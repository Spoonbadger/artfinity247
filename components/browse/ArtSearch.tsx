"use client";
// The one control on /art and /artists: a search bar. Click into it and a small filter panel opens (sort, verified
// artists, the busiest neighborhoods, and on /art starting price and print size). Start typing and it turns into
// suggestions instead: neighborhoods become filters on this page; on /art an artist does too, on /artists an artist
// opens their page; paintings open. Suggestions come from the server
// (/api/search/suggest), so this stays small however many artists there are. Choices live in the URL, so the
// server does the filtering and links can be shared. Search itself is a plain GET form (works without JS).
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import SearchTypeahead from "@/components/forms/SearchTypeahead";
import { ART_SORTS, ARTIST_SORTS, PRINT_SIZE_KEYS } from "@/components/browse/sortOptions";
import { SIZE_LABEL, sizeInches } from "@/components/art/pricing";
import { cn } from "@/lib/utils";

type City = { slug: string; name: string; pieces: number };
type Opt = { value: string; label: string; count?: number };

// Same storage keys UrlSort used, so a saved sort carries over.
const KIND = {
  art: { sorts: ART_SORTS, fallback: "newest", key: "af.sort.browse.art", filters: ["city", "size", "artist", "verified"], placeholder: "Search art, artists, neighborhoods", label: "Search art, artists and neighborhoods" },
  artists: { sorts: ARTIST_SORTS, fallback: "popular", key: "af.sort.browse.artists", filters: ["city", "verified"], placeholder: "Find an artist or neighborhood", label: "Find an artist or neighborhood" },
} as const;
const PLACES_SHOWN = 6; // the rest are a few letters away in the search box

export default function ArtSearch({ kind = "art", q, cities, priceMin, priceMax }: { kind?: keyof typeof KIND; q?: string; cities: City[]; priceMin?: string; priceMax?: string }) {
  const K = KIND[kind];
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(q ?? "");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setText(q ?? ""), [q]);

  const get = (k: string) => params.get(k) ?? "";
  const sort = K.sorts.some((s) => s.value === get("sort")) ? get("sort") : K.fallback;
  const priced = !!(priceMin || priceMax);
  const active = K.filters.filter((k) => get(k)).length + (priced ? 1 : 0);
  const typing = text.trim().length >= 2 && text.trim() !== (q ?? "");

  const urlWith = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v && !(k === "sort" && v === K.fallback)) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page"); // a new filter starts at page 1
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const set = (changes: Record<string, string>) => startTransition(() => router.replace(urlWith(changes), { scroll: false }));
  const pickSort = (v: string) => {
    try { window.localStorage.setItem(K.key, v); } catch { /* storage off */ }
    set({ sort: v });
  };

  // No sort in the URL: bring back the one this browser picked last time.
  useEffect(() => {
    if (params.get("sort")) return;
    try {
      const saved = window.localStorage.getItem(K.key);
      if (saved && saved !== K.fallback && K.sorts.some((s) => s.value === saved)) set({ sort: saved });
    } catch { /* storage off */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape, or when a click or Tab lands outside.
  useEffect(() => {
    if (!open) return;
    const outside = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const keep = Array.from(params.entries()).filter(([k]) => k !== "q" && k !== "page");
  const city = get("city");
  const places = cities.slice(0, PLACES_SHOWN);
  const picked = cities.find((c) => c.slug === city);
  if (picked && !places.includes(picked)) places.push(picked);

  return (
    <div ref={box} className="relative w-full md:w-[440px]">
      <form action={pathname} method="get" role="search" onSubmit={() => setOpen(false)}>
        {keep.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div className={cn("relative flex min-w-0 items-center gap-2 rounded-full border-2 border-ink bg-white py-1.5 pl-4 pr-1.5", (open || typing) && "border-scan")}>
          <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="min-w-0 flex-1" onFocus={() => setOpen(true)} onClick={() => setOpen(true)}>
            <SearchTypeahead
              value={text}
              onChange={(v) => { setText(v); setOpen(true); }}
              placeholder={K.placeholder}
              label={K.label}
              inputClassName="w-full min-w-0 border-0 bg-transparent p-0 py-1 text-[16px] text-ink outline-none placeholder:text-ink-2 md:text-[15px]"
              listClassName="-left-[2px] -right-[2px] top-[calc(100%+10px)]"
              onNavigate={() => setOpen(false)}
              hrefs={{
                ...(kind === "art" ? { artist: (slug: string) => urlWith({ artist: slug, q: "" }) } : {}),
                place: (href) => (href.startsWith("/scenes/") ? urlWith({ city: decodeURIComponent(href.slice(8)), q: "" }) : urlWith({ q: new URL(href, "http://x").searchParams.get("q") ?? "" })),
                all: (term) => urlWith({ q: term }),
              }}
            />
          </span>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open && !typing}
            aria-controls="art-filters"
            className={cn("inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold transition", active ? "bg-ink text-white" : "text-ink hover:bg-wall")}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters{active > 0 && <span className="num">· {active}</span>}
          </button>
        </div>
      </form>

      {open && !typing && (
        <div
          id="art-filters"
          role="group"
          aria-label="Filters"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 grid max-h-[min(72vh,600px)] gap-5 overflow-y-auto rounded-2xl border-[1.5px] border-ink bg-white p-4 shadow-[0_18px_40px_-12px_rgba(21,22,27,.35)] sm:p-5"
        >
          <Group label="Sort by" value={sort} onPick={pickSort} options={K.sorts} />
          {kind === "art" && (
            <>
              <PriceRange key={`${priceMin}-${priceMax}`} min={priceMin} max={priceMax} onApply={(min, max) => set({ min, max, price: "" })} />
              <Group label="Print size" value={get("size")} onPick={(v) => set({ size: v })} options={[{ value: "", label: "Any" }, ...PRINT_SIZE_KEYS.map((s) => ({ value: s, label: `${SIZE_LABEL[s]} · ${sizeInches(s)}` }))]} />
            </>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={!!get("verified")}
            onClick={() => set({ verified: get("verified") ? "" : "1" })}
            className="flex min-h-[44px] items-center justify-between gap-3 text-left"
          >
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
              <BadgeCheck className="h-5 w-5 text-scan" aria-hidden="true" />
              Verified artists only
            </span>
            <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition", get("verified") ? "bg-ink" : "bg-line")} aria-hidden="true">
              <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", get("verified") ? "left-[22px]" : "left-0.5")} />
            </span>
          </button>
          {cities.length > 1 && (
            <div className="grid gap-2">
              <Group label="Neighborhood" value={city} onPick={(v) => set({ city: v })} options={[{ value: "", label: "Everywhere" }, ...places.map((c) => ({ value: c.slug, label: c.name, count: c.pieces }))]} />
              {cities.length > places.length && <p className="t-small">Type a neighborhood to find more.</p>}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
            {active > 0 || sort !== K.fallback ? (
              <button type="button" onClick={() => set({ city: "", price: "", min: "", max: "", size: "", artist: "", verified: "", sort: "" })} className="inline-flex min-h-[40px] items-center gap-1 text-[14px] font-bold text-ink underline-offset-2 hover:underline">
                <X className="h-4 w-4" aria-hidden="true" /> Clear all
              </button>
            ) : <span />}
            <span className="flex items-center gap-3">
              {pending && <span className="t-small inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Updating</span>}
              <button type="button" onClick={() => setOpen(false)} className="btn btn-blue btn-sm">Done</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Starting price, any range: two dollar boxes, applied on Enter or when you leave them. */
function PriceRange({ min = "", max = "", onApply }: { min?: string; max?: string; onApply: (min: string, max: string) => void }) {
  const [lo, setLo] = useState(min);
  const [hi, setHi] = useState(max);
  const clean = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? "" : String(Math.round(Number(v))));
  const apply = () => {
    let a = clean(lo), b = clean(hi);
    if (a && b && Number(a) > Number(b)) [a, b] = [b, a];
    if (a !== min || b !== max) onApply(a, b);
  };
  const box = "flex min-h-[44px] min-w-0 flex-1 items-center gap-1 rounded-xl border-[1.5px] border-line bg-white px-3 focus-within:border-ink";
  const input = "num w-full min-w-0 border-0 bg-transparent p-0 text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-2 md:text-[15px]";
  return (
    <form
      className="grid gap-2"
      onSubmit={(e) => { e.preventDefault(); apply(); }}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) apply(); }}
    >
      <span className="eyebrow" id="price-h">Starting price</span>
      <div className="flex items-center gap-2" role="group" aria-labelledby="price-h">
        <label className={box}>
          <span className="text-ink-2">$</span>
          <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Min" aria-label="Minimum price, dollars" className={input} />
        </label>
        <span className="text-ink-2" aria-hidden="true">to</span>
        <label className={box}>
          <span className="text-ink-2">$</span>
          <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Max" aria-label="Maximum price, dollars" className={input} />
        </label>
        <button type="submit" className="btn btn-ghost btn-sm shrink-0">Set</button>
      </div>
    </form>
  );
}

function Group({ label, value, options, onPick }: { label: string; value: string; options: readonly Opt[]; onPick: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2">
      <span className="eyebrow">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value || "any"}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o.value)}
              className={cn("inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[14px] font-semibold transition md:min-h-[36px]", on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink")}
            >
              {o.label}
              {o.count != null && <span className={cn("num text-[13px]", on ? "text-white/70" : "text-ink-2")}>{o.count}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
