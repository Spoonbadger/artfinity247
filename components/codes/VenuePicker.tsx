"use client";

import { useId, useState } from "react";

export type VenueChoice = { id: string; name: string; neighborhood: string | null };
export type VenueValue = { venueId: string | null; venue: string };

const OTHER = "__other";

/**
 * Where a code hangs: one of Artfinity's partner venues (sets venueId and the venue text), or "Other place"
 * (free text only, no venueId). `fieldClass` / `labelClass` let each form keep its own field styles.
 */
export default function VenuePicker({
  venues, value, onChange, fieldClass = "af-field", labelClass = "label", maxLength = 60, label = "Venue", hint,
}: {
  venues: VenueChoice[];
  value: VenueValue;
  onChange: (v: VenueValue) => void;
  fieldClass?: string;
  labelClass?: string | null;
  maxLength?: number;
  label?: string;
  hint?: React.ReactNode;
}) {
  const id = useId();
  // "Other place" stays picked while its text box is empty.
  const [other, setOther] = useState(!value.venueId && !!value.venue.trim());
  const picked = value.venueId && venues.some((v) => v.id === value.venueId) ? value.venueId : other || (!value.venueId && value.venue.trim()) ? OTHER : "";
  const text = (t: string) => (labelClass ? <span className={labelClass}>{t}</span> : t);

  return (
    <>
      <label className={fieldClass} htmlFor={`${id}-s`}>
        {text(label)}
        <select
          id={`${id}-s`}
          value={picked}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) {
              setOther(true);
              // Keep typed text; a partner venue's name isn't "other" text.
              onChange({ venueId: null, venue: value.venueId ? "" : value.venue });
            } else if (!v) {
              setOther(false);
              onChange({ venueId: null, venue: "" });
            } else {
              setOther(false);
              const venue = venues.find((x) => x.id === v);
              onChange({ venueId: v, venue: (venue?.name || "").slice(0, maxLength) });
            }
          }}
        >
          <option value="">No venue</option>
          {venues.length > 0 && (
            <optgroup label="Artfinity partner venues">
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}{v.neighborhood ? ` · ${v.neighborhood}` : ""}</option>)}
            </optgroup>
          )}
          <option value={OTHER}>Other place…</option>
        </select>
        {hint && picked !== OTHER && <small>{hint}</small>}
      </label>
      {picked === OTHER && (
        <label className={fieldClass} htmlFor={`${id}-t`}>
          {text("Place name")}
          <input id={`${id}-t`} type="text" maxLength={maxLength} value={value.venue} placeholder="Open studio, a friend's shop…" onChange={(e) => onChange({ venueId: null, venue: e.target.value })} />
          {hint && <small>{hint}</small>}
        </label>
      )}
    </>
  );
}
