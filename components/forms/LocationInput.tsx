"use client";
// Location typeahead. Type "Wil" and it offers "Williamsburg, Brooklyn".
//   scope="nyc"     boroughs and neighborhoods (artist city, venue neighborhood, event location)
//   scope="us"      NYC first, then the biggest US cities and states (buyers)
//   scope="address" a street address. With NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set it asks Google Places; without it,
//                   it finishes the part after the last comma from the local list ("214 Bedford Ave, Bro" →
//                   "214 Bedford Ave, Brooklyn, NY") and leaves the rest to the browser's autofill.
// Suggestions come from lib/places.ts (bundled, no network) and follow the ARIA combobox pattern (useCombobox).
import { FocusEvent, ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { findNycPlace, postalCity, searchPlaces, type Place, type PlaceScope } from "@/lib/places";
import { useCombobox } from "./useCombobox";

/** What a pick tells the form, so it can fill sibling fields (state, ZIP…). */
export type PickedPlace = {
  value: string;
  kind: Place["kind"] | "address";
  city: string;
  borough?: string;
  state: string;
  line1?: string;
  zip?: string;
};

type Suggestion = { key: string; primary: string; secondary?: string; value: string; place?: Place; google?: { id: string; pick: () => Promise<PickedPlace | null> } };

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPick?: (place: PickedPlace) => void;
  scope?: PlaceScope | "address";
  /** Street address without Google: finish the city after the last comma from the local list. Off for split address forms. */
  localTail?: boolean;
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

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function LocationInput({
  value,
  onChange,
  onPick,
  scope = "nyc",
  tail = false,
  localTail = true,
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
  const auto = useId();
  const fid = id || auto;
  const msgId = `${fid}-msg`;
  const [typed, setTyped] = useState(false);
  const [google, setGoogle] = useState<Suggestion[]>([]);
  const useGoogle = scope === "address" && !!KEY;

  const local = useMemo<Suggestion[]>(() => {
    if (!typed) return [];
    if (scope === "address") return localTail ? addressTail(value) : [];
    const at = tail ? value.lastIndexOf(",") : -1;
    const head = at >= 0 ? value.slice(0, at).trim() : "";
    const q = at >= 0 ? value.slice(at + 1) : value;
    return searchPlaces(q, scope, 8)
      .filter((p) => p.value.toLowerCase() !== q.trim().toLowerCase())
      .map((p) => {
        const v = head ? `${head}, ${p.value}` : p.value;
        return { key: v, primary: p.primary, secondary: p.secondary, value: v, place: p };
      });
  }, [typed, value, scope, tail, localTail]);

  // Google Places for street addresses, debounced. Falls back to the local tail list if it fails to load.
  useEffect(() => {
    if (!useGoogle || !typed) return;
    const q = value.trim();
    if (q.length < 3) return setGoogle([]);
    let live = true;
    const t = setTimeout(async () => {
      const res = await googlePredictions(q).catch(() => null);
      if (live) setGoogle(res ?? []);
    }, 220);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [useGoogle, typed, value]);

  const items = useGoogle && google.length ? google : local;
  const usingGoogle = useGoogle && google.length > 0;

  async function choose(s: Suggestion) {
    setTyped(false);
    if (s.google) {
      onChange(s.value);
      const picked = await s.google.pick().catch(() => null);
      if (picked) {
        onChange(picked.value);
        onPick?.(picked);
      }
      return;
    }
    onChange(s.value);
    if (s.place) onPick?.({ value: s.value, kind: s.place.kind, city: s.place.city, borough: s.place.borough, state: s.place.state });
  }

  const cb = useCombobox<Suggestion>({ items, onPick: choose });
  const inputRef = useRef<HTMLInputElement>(null);

  function blur(e: FocusEvent<HTMLInputElement>) {
    // Typed a place exactly ("brooklyn", "LES")? Tidy it to the stored form.
    if (scope === "nyc" && typed && !tail) {
      const p = findNycPlace(value);
      if (p && p.value !== value) {
        onChange(p.value);
        onPick?.({ value: p.value, kind: p.kind, city: p.city, borough: p.borough, state: p.state });
      }
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
      autoComplete={autoComplete ?? (scope === "address" ? "street-address" : "address-level2")}
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
      className="absolute inset-x-0 top-[calc(100%+6px)] z-50 max-h-[min(320px,50vh)] overflow-auto rounded-xl border-2 border-ink bg-white p-1 shadow-[0_18px_40px_-12px_rgba(21,22,27,.35)]"
    >
      {items.map((s, i) => (
        <li
          key={s.key}
          {...cb.optionProps(i)}
          className={cn("flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left", i === cb.active ? "bg-scan-soft" : "hover:bg-wall")}
        >
          <MapPin className="h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-semibold text-ink">
              <Highlight text={s.primary} query={(scope === "address" && !usingGoogle) || tail ? value.split(",").pop() || "" : value} />
            </span>
            {s.secondary && <span className="block truncate text-[12.5px] text-ink-2">{s.secondary}</span>}
          </span>
        </li>
      ))}
      {usingGoogle && <li role="presentation" className="px-2.5 pb-1 pt-1.5 text-right text-[11px] text-ink-2">Powered by Google</li>}
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
        {label && <label htmlFor={fid} className="text-xs text-ink-2">{label}</label>}
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

/** Bold the part of `text` that matches what was typed. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.split(",")[0].trim();
  if (!q) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-extrabold text-ink underline decoration-sticker decoration-[3px] underline-offset-2">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/** Street address without Google: finish the city part after the last comma from the NYC list. */
function addressTail(value: string): Suggestion[] {
  const at = value.lastIndexOf(",");
  if (at < 0) return [];
  const head = value.slice(0, at).trim();
  const tail = value.slice(at + 1).trim();
  if (!head || tail.length < 2 || /\d{5}/.test(tail)) return [];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const p of searchPlaces(tail, "nyc", 10)) {
    // Mail goes to the borough's postal city; Queens uses the neighborhood ("Astoria, NY").
    const city = postalCity(p);
    const v = `${head}, ${city}, NY`;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push({ key: v, primary: city, secondary: p.kind === "neighborhood" ? `${p.city}, ${p.borough}` : "New York City", value: v });
    if (out.length >= 6) break;
  }
  return out;
}

/* ---------------- Google Places (only with a key) ---------------- */

let mapsPromise: Promise<any> | null = null;

function loadPlaces(): Promise<any> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const w = window as any;
    const ready = async () => {
      try {
        resolve(w.google.maps.importLibrary ? await w.google.maps.importLibrary("places") : w.google.maps.places);
      } catch (e) {
        reject(e);
      }
    };
    if (w.google?.maps) return void ready();
    w.__afPlacesReady = ready;
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&libraries=places&loading=async&callback=__afPlacesReady`;
    s.async = true;
    s.onerror = () => {
      mapsPromise = null;
      reject(new Error("Google Maps didn't load"));
    };
    document.head.appendChild(s);
  });
  return mapsPromise;
}

let session: any = null;
const NYC = { center: { lat: 40.7128, lng: -73.95 }, radius: 40000 };

async function googlePredictions(input: string): Promise<Suggestion[]> {
  const places = await loadPlaces();
  // Places API (New)
  if (places.AutocompleteSuggestion) {
    session ??= new places.AutocompleteSessionToken();
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input, sessionToken: session, includedRegionCodes: ["us"], locationBias: NYC });
    return (suggestions as any[])
      .filter((s) => s.placePrediction)
      .slice(0, 6)
      .map((s) => {
        const p = s.placePrediction;
        return {
          key: p.placeId,
          primary: p.mainText?.text ?? p.text.text,
          secondary: p.secondaryText?.text,
          value: p.text.text.replace(/, USA$/, ""),
          google: {
            id: p.placeId,
            pick: async () => {
              const place = p.toPlace();
              await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
              session = null;
              return fromComponents((place.addressComponents ?? []).map((c: any) => ({ long: c.longText, short: c.shortText, types: c.types })), place.formattedAddress);
            },
          },
        };
      });
  }
  // Older Places library
  const svc = new places.AutocompleteService();
  session ??= new places.AutocompleteSessionToken();
  const res: any = await svc.getPlacePredictions({ input, sessionToken: session, componentRestrictions: { country: "us" }, locationBias: NYC, types: ["address"] });
  return ((res?.predictions ?? []) as any[]).slice(0, 6).map((p) => ({
    key: p.place_id,
    primary: p.structured_formatting?.main_text ?? p.description,
    secondary: p.structured_formatting?.secondary_text,
    value: String(p.description).replace(/, USA$/, ""),
    google: {
      id: p.place_id,
      pick: () =>
        new Promise<PickedPlace | null>((resolve) => {
          new places.PlacesService(document.createElement("div")).getDetails({ placeId: p.place_id, fields: ["address_components", "formatted_address"], sessionToken: session }, (d: any) => {
            session = null;
            resolve(d ? fromComponents((d.address_components ?? []).map((c: any) => ({ long: c.long_name, short: c.short_name, types: c.types })), d.formatted_address) : null);
          });
        }),
    },
  }));
}

function fromComponents(parts: { long: string; short: string; types: string[] }[], formatted?: string): PickedPlace {
  const get = (t: string, short = false) => {
    const c = parts.find((x) => x.types.includes(t));
    return c ? (short ? c.short : c.long) : "";
  };
  const line1 = [get("street_number"), get("route", true)].filter(Boolean).join(" ");
  const city = get("locality") || get("sublocality_level_1") || get("sublocality") || get("neighborhood") || get("postal_town");
  const state = get("administrative_area_level_1", true);
  const zip = get("postal_code");
  const value = formatted ? formatted.replace(/, USA$/, "") : [line1, city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return { value, kind: "address", city, borough: get("sublocality_level_1") || undefined, state, line1, zip };
}
