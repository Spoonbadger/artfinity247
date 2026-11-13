"use client";
// Location typeahead for anywhere in the US. Type "wil" and it offers Williamsburg (Brooklyn), Wilmington, NC…
//   scope="place"        states, cities, towns and neighborhoods (artist location, events, venue areas)
//   scope="city"         cities, towns and neighborhoods; the field gets the mail city ("Williamsburg" fills "Brooklyn")
//   scope="state"        states only (instant, no network)
//   scope="neighborhood" neighborhoods and NYC boroughs
//   scope="address"      a street address. The server asks Google Places when GOOGLE_MAPS_API_KEY is set; without it,
//                        the part after the first comma is finished from our own list ("214 Bedford Ave, Brookl" →
//                        "214 Bedford Ave, Brooklyn, NY", "…, NY 112" → "…, NY 11211") and the browser autofills the rest.
// Suggestions come from GET /api/places (the data stays on the server): debounced, cancelled when stale, cached per
// query, with states and earlier answers shown instantly. Ranked by how well the name matches, then population;
// `near` (a state code) lifts that state. ARIA combobox pattern from useCombobox; Tab accepts the highlighted option.
import { FocusEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCombobox } from "./useCombobox";
import {
  addressProvider, cachedPlaces, fetchAddresses, fetchPlaces, fold, instantPlaces, localStates, newSession, resolveAddress,
  type AddressHit, type PlaceHit, type PlaceKind, type SearchKind,
} from "./placesClient";

/** What a pick tells the form, so it can fill sibling fields (state, ZIP…). `city` is the mail city. */
export type PickedPlace = {
  value: string;
  kind: PlaceKind | "address";
  city: string;
  state: string;
  neighborhood?: string;
  borough?: string;
  line1?: string;
  zip?: string;
};

export type LocationScope = "place" | "city" | "state" | "neighborhood" | "address";

type Suggestion = { key: string; primary: string; secondary?: string; value: string; mark: string; hit?: PlaceHit; google?: AddressHit; line1?: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick?: (place: PickedPlace) => void;
  /** "nyc" and "us" are older names for "place". */
  scope?: LocationScope | "nyc" | "us";
  /** A state code ("TX") whose places should come first. */
  near?: string | null;
  /** Street address: finish the city, state and ZIP after the first comma when Google has nothing. */
  localTail?: boolean;
  /** Street address with Google: "any" also offers businesses and venues by name. */
  addressTypes?: "address" | "any";
  /** Complete only the part after the last comma, keeping what's before ("Brooklyn Flea, DUM" → "Brooklyn Flea, DUMBO, Brooklyn"). */
  tail?: boolean;
  label?: string;
  hint?: ReactNode;
  error?: string | null;
  /** "box": the label-in-box .af-field look. "bare": just the input; pass `inputClassName` and label it by `id`. */
  variant?: "box" | "bare";
  inputClassName?: string;
  className?: string;
  id?: string;
  name?: string;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  "aria-describedby"?: string;
};

const KIND: Record<Exclude<LocationScope, "address">, SearchKind> = { place: "place", city: "city", state: "state", neighborhood: "neighborhood" };

export default function LocationInput({
  value,
  onChange,
  onPick,
  scope: rawScope = "place",
  near,
  tail = false,
  localTail = true,
  addressTypes = "address",
  label,
  hint,
  error,
  variant = "box",
  inputClassName,
  className,
  id,
  name,
  autoComplete,
  placeholder,
  maxLength = 120,
  required,
  disabled,
  autoFocus,
  onBlur,
  "aria-describedby": describedBy,
}: Props) {
  const scope: LocationScope = rawScope === "nyc" || rawScope === "us" ? "place" : rawScope;
  const auto = useId();
  const fid = id || auto;
  const msgId = `${fid}-msg`;
  const nearCode = near && /^[A-Za-z]{2}$/.test(near.trim()) ? near.trim().toUpperCase() : undefined;
  const [typed, setTyped] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const session = useRef<string | null>(null);

  // The field's value for a suggestion.
  function fieldValue(h: PlaceHit, head: string) {
    const v = scope === "city" ? h.city || h.primary : h.value;
    return head ? `${head}, ${v}` : v;
  }

  useEffect(() => {
    if (!typed) return setItems([]);
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (scope === "address") {
      const v = value.trim();
      const at = v.indexOf(",");
      const head = at >= 0 ? v.slice(0, at).trim() : "";
      const rest = at >= 0 ? v.slice(at + 1) : "";
      const fromTail = (hits: PlaceHit[]): Suggestion[] =>
        hits.map((h) => ({ key: `t:${h.value}`, primary: `${head}, ${h.value}`, secondary: h.secondary, value: `${head}, ${h.value}`, mark: rest.split(",").pop()!.trim(), hit: h, line1: head }));
      const local = async () => {
        if (!localTail || !head || fold(rest).length < 1) return [];
        return fromTail(await fetchPlaces(rest, "address", { near: nearCode, limit: 6, signal: ctrl.signal }));
      };
      if (v.length < 3) return setItems([]);
      const cached = localTail && head ? cachedPlaces(rest, "address", nearCode) : undefined;
      if (cached && addressProvider() === "none") setItems(fromTail(cached));
      timer = setTimeout(async () => {
        try {
          let next: Suggestion[] = [];
          if (addressProvider() !== "none") {
            session.current ??= newSession();
            const g = await fetchAddresses(v, session.current, { types: addressTypes, signal: ctrl.signal }).catch((e) => {
              if ((e as Error)?.name === "AbortError") throw e;
              return [];
            });
            next = g.map((r) => ({ key: `g:${r.id}`, primary: r.primary, secondary: r.secondary, value: r.value, mark: v.split(",")[0], google: r }));
          }
          if (!next.length) next = await local();
          if (!ctrl.signal.aborted) setItems(next);
        } catch {
          /* cancelled */
        }
      }, addressProvider() === "none" ? 120 : 220);
      return () => {
        ctrl.abort();
        clearTimeout(timer);
      };
    }

    const kind = KIND[scope];
    const at = tail ? value.lastIndexOf(",") : -1;
    const head = at >= 0 ? value.slice(0, at).trim() : "";
    const q = at >= 0 ? value.slice(at + 1) : value;
    const mark = q.split(",")[0].trim();
    const toItems = (hits: PlaceHit[]) =>
      hits
        .map((h) => ({ key: `${h.kind}:${h.value}:${h.city}`, primary: h.primary, secondary: h.secondary, value: fieldValue(h, head), mark, hit: h }))
        .filter((s, i, all) => fold(s.value) !== fold(value) || all.length > 1)
        .filter((s, i, all) => all.findIndex((o) => o.key === s.key) === i);
    const f = fold(q);
    if (!f) return setItems([]);
    // States never need the network; neither does a query we've already answered.
    if (kind === "state") return setItems(toItems(localStates(f)));
    const cached = cachedPlaces(q, kind, nearCode);
    if (cached) return setItems(toItems(cached));
    setItems(toItems(instantPlaces(q, kind, nearCode)));
    if (f.length < 2) return;
    timer = setTimeout(() => {
      fetchPlaces(q, kind, { near: nearCode, signal: ctrl.signal })
        .then((hits) => !ctrl.signal.aborted && setItems(toItems(hits)))
        .catch(() => {});
    }, 150);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
    // fieldValue only reads scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, value, scope, tail, localTail, nearCode, addressTypes]);

  const usingGoogle = items.some((s) => s.google);

  async function choose(s: Suggestion) {
    setTyped(false);
    onChange(s.value);
    if (s.google) {
      const picked = await resolveAddress(s.google.id, session.current ?? newSession());
      session.current = null;
      if (picked) {
        onChange(picked.value);
        onPick?.(picked);
      }
      return;
    }
    const h = s.hit;
    if (!h) return;
    onPick?.({ value: s.value, kind: s.line1 !== undefined ? "address" : h.kind, city: h.city, state: h.state, neighborhood: h.neighborhood, borough: h.borough, zip: h.zip, line1: s.line1 });
  }

  const cb = useCombobox<Suggestion>({ items, onPick: choose, tabAccepts: true });
  const inputRef = useRef<HTMLInputElement>(null);

  function blur(e: FocusEvent<HTMLInputElement>) {
    // Typed a place in full ("brooklyn", "austin, tx") and it can only be one thing? Tidy it to the stored form.
    if (typed && scope !== "address" && !tail) {
      const v = fold(value);
      const same = items.filter((s) => s.hit && (fold(s.value) === v || fold(s.hit.primary) === v));
      if (same.length === 1 && same[0].value !== value) choose(same[0]);
    }
    setTyped(false);
    onBlur?.(e);
  }

  const input = (
    <input
      ref={inputRef}
      id={fid}
      name={name}
      type="text"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        setTyped(true);
        cb.setOpen(true);
      }}
      onBlur={blur}
      autoComplete={autoComplete ?? (scope === "address" ? "street-address" : scope === "state" ? "address-level1" : "address-level2")}
      autoCapitalize="words"
      spellCheck={false}
      enterKeyHint="next"
      placeholder={placeholder}
      maxLength={maxLength}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-invalid={error ? true : undefined}
      aria-describedby={[describedBy, error || hint ? msgId : null].filter(Boolean).join(" ") || undefined}
      className={variant === "bare" ? inputClassName : cn("min-w-0 flex-1", inputClassName)}
      {...cb.inputProps}
    />
  );

  const list = cb.shown && (
    <ul
      {...cb.listProps}
      aria-label={scope === "address" ? "Address suggestions" : "Place suggestions"}
      className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[min(352px,50vh)] overflow-auto overscroll-contain rounded-xl border border-edge bg-white p-1 shadow-[0_18px_40px_-12px_rgba(21,22,27,.35)]"
    >
      {items.map((s, i) => (
        <li
          key={s.key}
          {...cb.optionProps(i)}
          className={cn("flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left", i === cb.active ? "bg-scan-soft" : "hover:bg-wall")}
        >
          <MapPin className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[15px] font-semibold text-ink">
              <Highlight text={s.primary} query={s.mark} />
            </span>
            {s.secondary && <span className="block truncate text-[13px] text-ink-2">{s.secondary}</span>}
          </span>
        </li>
      ))}
      {usingGoogle && <li role="presentation" className="px-2.5 pb-1 pt-1.5 text-right text-[12px] text-ink-2">Powered by Google</li>}
    </ul>
  );

  if (variant === "bare")
    return (
      <div ref={cb.wrapRef} className={cn("relative", className)}>
        {input}
        {list}
        {(error || hint) && (
          <div id={msgId} className={cn("mt-1 text-[13px]", error ? "font-semibold text-coral" : "font-normal text-ink-2")} aria-live="polite">
            {error || hint}
          </div>
        )}
      </div>
    );

  return (
    <div ref={cb.wrapRef} className={cn("relative grid gap-1.5", className)}>
      <div
        className={cn("af-field cursor-text", error && "!border-coral focus-within:!shadow-[0_0_0_3px_#ffd9cf]")}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("input,button,label,[role=listbox]")) return;
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        {label && <label htmlFor={fid} className="text-[13px] text-ink-2">{label}</label>}
        <span className="flex min-w-0 items-baseline">{input}</span>
      </div>
      {list}
      {(error || hint) && (
        <div id={msgId} className={cn("px-1 text-[13.5px]", error ? "font-semibold text-coral" : "text-ink-2")} aria-live="polite">
          {error || hint}
        </div>
      )}
    </div>
  );
}

/** Bold the part of `text` that matches what was typed: at the start or at a word start, ignoring case and accents. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query);
  if (!q) return <>{text}</>;
  // Fold one character at a time, remembering where each folded character came from.
  let folded = "";
  const from: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = fold(text[i]) || (/[\s\-/,]/.test(text[i]) ? " " : "");
    for (const ch of c) {
      folded += ch;
      from.push(i);
    }
  }
  let at = -1;
  for (let i = folded.indexOf(q); i >= 0; i = folded.indexOf(q, i + 1)) {
    if (i === 0 || folded[i - 1] === " ") {
      at = i;
      break;
    }
  }
  if (at < 0) return <>{text}</>;
  const start = from[at];
  const end = from[at + q.length - 1] + 1;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent font-extrabold text-ink underline decoration-sticker decoration-[3px] underline-offset-2">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
