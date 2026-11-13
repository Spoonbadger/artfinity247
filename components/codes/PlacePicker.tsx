"use client";

import { useId, useState } from "react";
import type { PlaceInput } from "@/lib/placeRules";

/** One of the artist's Places (lib/artistPlaces.ts placeOptions). */
export type PlaceChoice = { id: string; name: string; area: string | null; venueId: string | null; ended: boolean };
/** A partner venue none of the artist's Places link to yet (picking one makes the Place). */
export type PartnerChoice = { id: string; name: string; neighborhood: string | null };
/** placeId set: an existing Place. venueId set without placeId: a partner venue. name only: a new Place. All empty: none. */
export type PlaceValue = { placeId: string | null; venueId: string | null; name: string };

export const NO_PLACE: PlaceValue = { placeId: null, venueId: null, name: "" };
const NEW = "__new";

/** What to send to the server for a picked value ({ id } | { venueId } | { name } | null). */
export function placeInput(v: PlaceValue): PlaceInput {
  if (v.placeId) return { id: v.placeId };
  if (v.venueId) return { venueId: v.venueId };
  return v.name.trim() ? { name: v.name.trim() } : null;
}
export const samePlace = (a: PlaceValue, b: PlaceValue) => a.placeId === b.placeId && a.venueId === b.venueId && a.name.trim() === b.name.trim();

/**
 * Where something hangs: one of the artist's Places, a partner venue (becomes a Place), a new Place by name, or none.
 * `fieldClass` / `labelClass` let each form keep its own field styles.
 */
export default function PlacePicker({
  places, partners = [], value, onChange, fieldClass = "af-field", labelClass = "label", maxLength = 60, label = "Place", hint, noneLabel = "No place",
}: {
  places: PlaceChoice[];
  partners?: PartnerChoice[];
  value: PlaceValue;
  onChange: (v: PlaceValue) => void;
  fieldClass?: string;
  labelClass?: string | null;
  maxLength?: number;
  label?: string;
  hint?: React.ReactNode;
  noneLabel?: string;
}) {
  const id = useId();
  // "New place" stays picked while its text box is empty.
  const [typing, setTyping] = useState(!value.placeId && !value.venueId && !!value.name.trim());
  const picked = value.placeId ? `p:${value.placeId}` : value.venueId ? `v:${value.venueId}` : typing || value.name.trim() ? NEW : "";
  const text = (t: string) => (labelClass ? <span className={labelClass}>{t}</span> : t);
  const open = places.filter((p) => !p.ended), ended = places.filter((p) => p.ended);

  return (
    <>
      <label className={fieldClass} htmlFor={`${id}-s`}>
        {text(label)}
        <select
          id={`${id}-s`}
          value={picked}
          onChange={(e) => {
            const v = e.target.value;
            if (v === NEW) { setTyping(true); onChange({ placeId: null, venueId: null, name: "" }); return; }
            setTyping(false);
            if (v.startsWith("p:")) { const p = places.find((x) => x.id === v.slice(2)); onChange({ placeId: v.slice(2), venueId: p?.venueId ?? null, name: (p?.name || "").slice(0, maxLength) }); }
            else if (v.startsWith("v:")) { const p = partners.find((x) => x.id === v.slice(2)); onChange({ placeId: null, venueId: v.slice(2), name: (p?.name || "").slice(0, maxLength) }); }
            else onChange(NO_PLACE);
          }}
        >
          <option value="">{noneLabel}</option>
          {open.length > 0 && (
            <optgroup label="My places">
              {open.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}{p.area ? ` · ${p.area}` : ""}</option>)}
            </optgroup>
          )}
          {partners.length > 0 && (
            <optgroup label="Artfinity partner venues">
              {partners.map((v) => <option key={v.id} value={`v:${v.id}`}>{v.name}{v.neighborhood ? ` · ${v.neighborhood}` : ""}</option>)}
            </optgroup>
          )}
          {ended.length > 0 && (
            <optgroup label="Closed or ended">
              {ended.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
            </optgroup>
          )}
          <option value={NEW}>New place…</option>
        </select>
        {hint && picked !== NEW && <small>{hint}</small>}
      </label>
      {picked === NEW && (
        <label className={fieldClass} htmlFor={`${id}-t`}>
          {text("New place name")}
          <input id={`${id}-t`} type="text" maxLength={maxLength} value={value.name} placeholder="Lumen Café, a friend's shop…" onChange={(e) => onChange({ placeId: null, venueId: null, name: e.target.value })} />
          {hint && <small>{hint}</small>}
        </label>
      )}
    </>
  );
}
