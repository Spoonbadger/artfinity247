"use client";
// A Place's details: name, kind, area, optional dates and partner venue. Used to add one (NewPlaceButton) and to
// edit one (the Place page's "Details").
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { PLACE_KINDS, type PlaceKind } from "@/lib/placeRules";
import SmallDialog from "./SmallDialog";

export type PlaceFormValues = { name: string; kind: string; area: string; startsOn: string; endsOn: string; venueId: string };
export type PartnerVenue = { id: string; name: string; neighborhood: string | null };

export const EMPTY_PLACE: PlaceFormValues = { name: "", kind: "cafe", area: "", startsOn: "", endsOn: "", venueId: "" };

export function PlaceFields({ v, set, partners, idp }: { v: PlaceFormValues; set: (p: Partial<PlaceFormValues>) => void; partners: PartnerVenue[]; idp: string }) {
  return (
    <div className="grid gap-4">
      <label className="af-field" htmlFor={`${idp}-name`}>
        <span className="label">Name</span>
        <input id={`${idp}-name`} type="text" required maxLength={60} value={v.name} placeholder="Lumen Café" onChange={(e) => set({ name: e.target.value })} data-autofocus />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="af-field" htmlFor={`${idp}-kind`}>
          <span className="label">Kind</span>
          <select id={`${idp}-kind`} value={v.kind} onChange={(e) => set({ kind: e.target.value })}>
            {(Object.keys(PLACE_KINDS) as PlaceKind[]).map((k) => <option key={k} value={k}>{PLACE_KINDS[k]}</option>)}
          </select>
        </label>
        <label className="af-field" htmlFor={`${idp}-area`}>
          <span className="label">Neighborhood or address</span>
          <input id={`${idp}-area`} type="text" maxLength={100} value={v.area} placeholder="Williamsburg" onChange={(e) => set({ area: e.target.value })} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="af-field" htmlFor={`${idp}-start`}>
          <span className="label">First day (optional)</span>
          <input id={`${idp}-start`} type="date" value={v.startsOn} onChange={(e) => set({ startsOn: e.target.value })} />
        </label>
        <label className="af-field" htmlFor={`${idp}-end`}>
          <span className="label">Last day (optional)</span>
          <input id={`${idp}-end`} type="date" value={v.endsOn} min={v.startsOn || undefined} onChange={(e) => set({ endsOn: e.target.value })} />
          <small>For shows and pop-ups. Codes keep working after it.</small>
        </label>
      </div>
      {partners.length > 0 && (
        <label className="af-field" htmlFor={`${idp}-venue`}>
          <span className="label">Artfinity partner venue</span>
          <select id={`${idp}-venue`} value={v.venueId} onChange={(e) => set({ venueId: e.target.value })}>
            <option value="">Not a partner venue</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}{p.neighborhood ? ` · ${p.neighborhood}` : ""}</option>)}
          </select>
          <small>Partner venues earn a small share of sales from codes on their walls.</small>
        </label>
      )}
    </div>
  );
}

export const placeBody = (v: PlaceFormValues) => ({ name: v.name, kind: v.kind, area: v.area, startsOn: v.startsOn || null, endsOn: v.endsOn || null, venueId: v.venueId || null });

/** "Add a place": a small dialog, then straight to the new Place. */
export function NewPlaceButton({ partners, primary = true }: { partners: PartnerVenue[]; primary?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<PlaceFormValues>(EMPTY_PLACE);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) { document.getElementById("np-name")?.focus(); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/studio/places", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(placeBody(v)) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't add the place. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => formRef.current?.requestSubmit() });
        return;
      }
      const { place } = await r.json();
      saved(`Added ${place.name}`, { description: "Hang paintings and codes here." });
      setOpen(false);
      setV(EMPTY_PLACE);
      router.push(`/studio/places/${place.id}`);
    } catch (err) {
      failed(errorText(err, "Couldn't add the place. Try again."), { retry: () => formRef.current?.requestSubmit() });
    } finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className={primary ? "btn btn-blue btn-sm" : "btn btn-ghost btn-sm"} onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />Add a place
      </button>
      {open && (
        <SmallDialog label="Add a place" onClose={() => !busy && setOpen(false)}>
          <form ref={formRef} onSubmit={submit} className="grid gap-5" noValidate>
            <h2 className="t-card">Add a place</h2>
            <PlaceFields v={v} set={(p) => setV((o) => ({ ...o, ...p }))} partners={partners} idp="np" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-blue" disabled={busy || !v.name.trim()}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Add place
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            </div>
          </form>
        </SmallDialog>
      )}
    </>
  );
}
