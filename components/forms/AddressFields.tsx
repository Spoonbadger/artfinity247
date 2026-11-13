"use client";
// A US shipping address, split the way browsers autofill it: name, street (address-line1), apt (address-line2),
// city (address-level2), state (address-level1), ZIP (postal-code). Street suggests addresses (Google Places through
// the server when GOOGLE_MAPS_API_KEY is set) and fills the rest from the pick; typing or pasting "214 Bedford Ave,
// Brookl" works without Google too. City suggests any US city, town or neighborhood (picking Williamsburg fills
// Brooklyn, NY). A full ZIP fills an empty city and state. Each field checks itself on blur with a specific fix; the
// ZIP formats as you type, the state becomes its 2-letter code.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { stateCode } from "@/lib/places";
import { checks, formatZip } from "@/lib/smartFields";
import LocationInput from "./LocationInput";
import { fetchPlaces } from "./placesClient";

export type Address = { name?: string; line1: string; line2: string; city: string; state: string; zip: string };
type Key = keyof Address;

const RULES: Partial<Record<Key, (v: string) => string | null>> = {
  name: (v) => (v.trim() ? null : "Add the name for the label."),
  line1: (v) => (v.trim() ? (/\d/.test(v) ? null : "Add the house or building number, like 214 Bedford Ave.") : "Add the street address."),
  city: (v) => (v.trim() ? null : "Add the city, like Brooklyn."),
  state: (v) => (v.trim() ? (stateCode(v) ? null : "Use the 2-letter state, like NY.") : "Add the state, like NY."),
  zip: checks.zip,
};

/** Check a whole address (on submit). Returns the first field with a problem and its message, or null. */
export function addressProblem(a: Address, withName = true): { field: Key; message: string } | null {
  for (const k of (withName ? ["name", "line1", "city", "state", "zip"] : ["line1", "city", "state", "zip"]) as Key[]) {
    const m = RULES[k]?.(a[k] ?? "");
    if (m) return { field: k, message: m };
  }
  return null;
}

export default function AddressFields({
  value,
  onChange,
  idPrefix = "ship",
  withName = true,
  autoComplete = "shipping",
  className,
}: {
  value: Address;
  onChange: (next: Address) => void;
  idPrefix?: string;
  withName?: boolean;
  /** The autofill section token: "shipping" or "billing". */
  autoComplete?: "shipping" | "billing";
  className?: string;
}) {
  const [errors, setErrors] = useState<Partial<Record<Key, string | null>>>({});
  const set = (patch: Partial<Address>) => onChange({ ...value, ...patch });
  const ac = (t: string) => `${autoComplete} ${t}`;
  const blur = (k: Key, v: string) => setErrors((x) => ({ ...x, [k]: RULES[k]?.(v) ?? null }));
  const fix = (k: Key, v: string) => errors[k] && !RULES[k]?.(v) && setErrors((x) => ({ ...x, [k]: null }));
  const id = (k: Key) => `${idPrefix}-${k}`;
  const msg = (k: Key) =>
    errors[k] ? (
      <span id={`${id(k)}-err`} className="px-1 text-[13px] font-semibold text-coral" aria-live="polite">
        {errors[k]}
      </span>
    ) : null;
  const box = (k: Key) => cn("af-field", errors[k] && "!border-coral");
  const near = stateCode(value.state) ?? undefined;

  // A full ZIP fills an empty city and state ("11211" → Brooklyn, NY).
  const latest = useRef(value);
  latest.current = value;
  const zip5 = /^\d{5}/.test(value.zip) ? value.zip.slice(0, 5) : "";
  useEffect(() => {
    if (!zip5 || (latest.current.city.trim() && latest.current.state.trim())) return;
    const ctrl = new AbortController();
    fetchPlaces(zip5, "zip", { signal: ctrl.signal })
      .then(([z]) => {
        const v = latest.current;
        if (!z || ctrl.signal.aborted || v.zip.slice(0, 5) !== zip5) return;
        onChange({ ...v, city: v.city.trim() || z.city, state: v.state.trim() || z.state });
        setErrors((x) => ({ ...x, city: null, state: null }));
      })
      .catch(() => {});
    return () => ctrl.abort();
    // Only when the ZIP changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zip5]);
  const aria = (k: Key) => ({ "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${id(k)}-err` : undefined });

  return (
    <div className={cn("grid gap-2.5 sm:grid-cols-6", className)}>
      {withName && (
        <div className="grid gap-1 sm:col-span-6">
          <label className={box("name")} htmlFor={id("name")}>
            <span className="label">Name</span>
            <input
              id={id("name")} name="name" autoComplete={ac("name")} autoCapitalize="words" value={value.name ?? ""} {...aria("name")}
              onChange={(e) => { set({ name: e.target.value }); fix("name", e.target.value); }} onBlur={(e) => blur("name", e.target.value)}
            />
          </label>
          {msg("name")}
        </div>
      )}
      <div className="grid gap-1 sm:col-span-4">
        <LocationInput
          id={id("line1")}
          label="Street"
          name="address-line1"
          scope="address"
          near={near}
          autoComplete={ac("address-line1")}
          value={value.line1}
          onChange={(v) => { set({ line1: v }); fix("line1", v); }}
          onPick={(p) => {
            onChange({ ...value, line1: p.line1 || value.line1, city: p.city || value.city, state: p.state || value.state, zip: p.zip ? formatZip(p.zip) : p.city && p.city !== value.city ? "" : value.zip });
            setErrors({});
          }}
          onBlur={(e) => blur("line1", e.target.value)}
          error={errors.line1}
          maxLength={120}
          placeholder="214 Bedford Ave"
        />
      </div>
      <label className={cn(box("line2"), "sm:col-span-2")} htmlFor={id("line2")}>
        <span className="label">Apt <span className="text-ink-2">(optional)</span></span>
        <input id={id("line2")} name="address-line2" autoComplete={ac("address-line2")} value={value.line2} onChange={(e) => set({ line2: e.target.value })} maxLength={60} />
      </label>
      <div className="grid gap-1 sm:col-span-3">
        <LocationInput
          id={id("city")}
          label="City"
          name="address-level2"
          scope="city"
          near={near}
          autoComplete={ac("address-level2")}
          value={value.city}
          onChange={(v) => { set({ city: v }); fix("city", v); }}
          onPick={(p) => {
            onChange({ ...value, city: p.city, state: p.state || value.state });
            setErrors((x) => ({ ...x, city: null, state: null }));
          }}
          onBlur={(e) => blur("city", e.target.value)}
          error={errors.city}
          maxLength={60}
          placeholder="Brooklyn"
        />
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:col-span-3">
        <div className="grid content-start gap-1">
          <label className={box("state")} htmlFor={id("state")}>
            <span className="label">State</span>
            <input
              id={id("state")} name="address-level1" autoComplete={ac("address-level1")} autoCapitalize="characters" maxLength={30} value={value.state} {...aria("state")}
              onChange={(e) => { set({ state: e.target.value }); fix("state", e.target.value); }}
              onBlur={(e) => {
                const code = stateCode(e.target.value);
                if (code && code !== value.state) set({ state: code });
                blur("state", e.target.value);
              }}
              placeholder="NY"
            />
          </label>
          {msg("state")}
        </div>
        <div className="grid content-start gap-1">
          <label className={box("zip")} htmlFor={id("zip")}>
            <span className="label">ZIP</span>
            <input
              id={id("zip")} name="postal-code" autoComplete={ac("postal-code")} inputMode="numeric" maxLength={10} value={value.zip} {...aria("zip")}
              onChange={(e) => { const z = formatZip(e.target.value); set({ zip: z }); fix("zip", z); }} onBlur={(e) => blur("zip", e.target.value)}
              placeholder="11211"
            />
          </label>
          {msg("zip")}
        </div>
      </div>
    </div>
  );
}
