"use client";
// Edit art: where the painting hangs now (one Place at a time), with its recent history.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import PlacePicker, { NO_PLACE, placeInput, samePlace, type PartnerChoice, type PlaceChoice, type PlaceValue } from "@/components/codes/PlacePicker";

export type HangingRow = { id: string; place: string; placeId: string; from: string; to: string | null };

export default function HangingCard({ artworkId, title, current, places, partners, history }: {
  artworkId: string; title: string; current: { id: string; name: string } | null; places: PlaceChoice[]; partners: PartnerChoice[]; history: HangingRow[];
}) {
  const router = useRouter();
  const start: PlaceValue = current ? { placeId: current.id, venueId: null, name: current.name } : NO_PLACE;
  const [v, setV] = useState<PlaceValue>(start);
  const [busy, setBusy] = useState(false);
  const dirty = !samePlace({ ...v, venueId: v.placeId ? null : v.venueId }, start);

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/studio/hangings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artworkIds: [artworkId], place: placeInput(v) }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't save that. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : save });
        return;
      }
      const j = await r.json();
      saved(j.place ? `${title} hangs at ${j.place.name}` : `${title} is back home`, j.place ? { next: { label: `Open ${j.place.name}`, href: `/studio/places/${j.place.id}` } } : undefined);
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't save that. Try again."), { retry: save });
    } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="hang-h" className="box grid gap-3 p-4 sm:p-5">
      <div className="grid gap-0.5">
        <h2 id="hang-h" className="t-card">Currently hanging at</h2>
        <p className="t-small">{current ? <>At <Link href={`/studio/places/${current.id}`} className="font-semibold text-scan">{current.name}</Link> now.</> : "At home. Not hanging anywhere."}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:max-w-[360px]">
          <PlacePicker places={places} partners={partners} value={v} onChange={setV} label="Place" noneLabel="At home" />
        </div>
        <button type="button" className="btn btn-sm" onClick={save} disabled={!dirty || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}{dirty ? "Save" : "Saved"}
        </button>
      </div>
      {history.length > 0 && (
        <details>
          <summary className="t-small cursor-pointer font-semibold">Where it has hung</summary>
          <ul className="mt-2 grid gap-1 text-[14px]">
            {history.map((h) => <li key={h.id}><Link href={`/studio/places/${h.placeId}`} className="font-semibold text-ink underline-offset-2 hover:underline">{h.place}</Link> <span className="t-small">· {h.from} – {h.to ?? "now"}</span></li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
