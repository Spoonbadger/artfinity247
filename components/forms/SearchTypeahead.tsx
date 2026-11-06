"use client";
// Search box with suggestions as you type: artists, paintings and neighborhoods (from /api/search/suggest, which
// reuses the /search page's queries). Arrows move, Enter opens the highlighted one or searches what was typed, Esc
// closes. Renders the input and its list; put it inside a positioned element (the list hangs off it) and a form
// that GETs /search, so it still works before JavaScript loads.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { artistPath, artPath } from "@/lib/urls";
import { useCombobox } from "./useCombobox";

type Data = {
  artists: { slug: string; name: string; city: string; avatar: string | null }[];
  art: { slug: string; title: string; artist: string; handle: string; imageUrl: string; sensitive: boolean }[];
  places: { label: string; sub?: string; href: string }[];
};
type Item = { key: string; group: "Artists" | "Art" | "Neighborhoods" | ""; label: string; sub?: string; href: string; img?: string | null; blur?: boolean; round?: boolean };

const memo = new Map<string, Data>();

export default function SearchTypeahead({
  value,
  onChange,
  defaultValue = "",
  name = "q",
  placeholder,
  inputClassName,
  listClassName,
  autoFocus,
  enterKeyHint = "search",
  label = "Search art, artists and neighborhoods",
  onNavigate,
}: {
  value?: string;
  onChange?: (v: string) => void;
  defaultValue?: string;
  name?: string;
  placeholder?: string;
  inputClassName?: string;
  listClassName?: string;
  autoFocus?: boolean;
  enterKeyHint?: "search" | "go";
  label?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const [own, setOwn] = useState(defaultValue);
  const q = value ?? own;
  const set = (v: string) => (onChange ? onChange(v) : setOwn(v));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const typedRef = useRef(false);

  useEffect(() => {
    const term = q.trim();
    if (!typedRef.current || term.length < 2) {
      setData(null);
      return;
    }
    const hit = memo.get(term.toLowerCase());
    if (hit) return setData(hit);
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!r.ok) return;
        const d = (await r.json()) as Data;
        memo.set(term.toLowerCase(), d);
        setData(d);
      } catch {
        // offline or aborted: the form still submits to /search
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const term = q.trim();
  // Memoized: the combobox resets its highlight whenever this list changes.
  const items = useMemo(() => {
    const out: Item[] = [];
    if (!data || term.length < 2) return out;
    for (const a of data.artists) out.push({ key: `a-${a.slug}`, group: "Artists", label: a.name, sub: a.city, href: artistPath(a.slug), img: a.avatar, round: true });
    for (const a of data.art) out.push({ key: `w-${a.handle}-${a.slug}`, group: "Art", label: a.title, sub: a.artist, href: artPath(a.handle, a.slug), img: a.imageUrl, blur: a.sensitive });
    for (const p of data.places) out.push({ key: `p-${p.href}`, group: "Neighborhoods", label: p.label, sub: p.sub, href: p.href });
    out.push({ key: "all", group: "", label: `See all results for “${term}”`, href: `/search?q=${encodeURIComponent(term)}` });
    return out;
  }, [data, term]);

  const cb = useCombobox<Item>({
    items,
    onPick: (it) => {
      typedRef.current = false;
      setData(null);
      onNavigate?.();
      router.push(it.href);
    },
    onEscapeEmpty: () => set(""),
  });

  const status = loading ? "" : data && term.length >= 2 ? `${items.length - 1} suggestions` : "";

  return (
    <div ref={cb.wrapRef} className="contents">
      <input
        type="search"
        name={name}
        value={q}
        onChange={(e) => {
          typedRef.current = true;
          set(e.target.value);
          cb.setOpen(true);
        }}
        onFocus={() => data && cb.setOpen(true)}
        placeholder={placeholder}
        maxLength={80}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        aria-label={label}
        className={inputClassName}
        {...cb.inputProps}
      />
      <span className="sr-only" role="status" aria-live="polite">{cb.open ? status : ""}</span>
      {cb.shown && (
        <ul
          {...cb.listProps}
          aria-label="Suggestions"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[min(440px,65vh)] overflow-auto rounded-2xl border border-edge bg-white p-1.5 text-left shadow-[0_18px_40px_-12px_rgba(21,22,27,.35)]",
            listClassName,
          )}
        >
          {items.map((it, i) => {
            const head = it.group && items[i - 1]?.group !== it.group;
            return (
              <li key={it.key} {...cb.optionProps(i)} aria-label={it.group ? `${it.label}${it.sub ? `, ${it.sub}` : ""}` : it.label} className={cn("cursor-pointer rounded-xl", !it.group && "mt-1 border-t border-line pt-1")}>
                {head && <span aria-hidden="true" className="eyebrow block px-2.5 pb-1 pt-2">{it.group}</span>}
                <span className={cn("flex min-h-[44px] items-center gap-2.5 rounded-xl px-2.5 py-1.5", i === cb.active ? "bg-scan-soft" : "hover:bg-wall")}>
                  {it.group === "" ? (
                    <Search className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
                  ) : it.group === "Neighborhoods" ? (
                    <i className="paint-dab !h-4 !w-4" style={{ ["--dab" as string]: "#ffd43b" }} aria-hidden="true" />
                  ) : (
                    <span className={cn("relative block h-9 w-9 shrink-0 overflow-hidden bg-gallery", it.round ? "rounded-full" : "rounded-[4px]")}>
                      {it.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.img} alt="" loading="lazy" className={cn("h-full w-full object-cover", it.blur && "sensitive-blur")} />
                      ) : (
                        <span className="grid h-full w-full place-items-center font-display text-[14px] font-extrabold text-ink">{it.label[0]?.toUpperCase()}</span>
                      )}
                    </span>
                  )}
                  <span className="min-w-0 leading-tight">
                    <span className={cn("block truncate text-[15px] text-ink", it.group ? "font-semibold" : "font-bold text-scan")}>{it.label}</span>
                    {it.sub && <span className="block truncate text-[13px] text-ink-2">{it.sub}</span>}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
