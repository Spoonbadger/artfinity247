"use client";
// Print queue: "Printing these for a place?" Tags every queued code to a Place in one go.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin } from "lucide-react";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import PlacePicker, { NO_PLACE, placeInput, type PartnerChoice, type PlaceChoice, type PlaceValue } from "@/components/codes/PlacePicker";

export default function QueuePlaceTag({ places, partners, current }: { places: PlaceChoice[]; partners: PartnerChoice[]; current: { id: string; name: string } | null }) {
  const router = useRouter();
  const [v, setV] = useState<PlaceValue>(current ? { placeId: current.id, venueId: null, name: current.name } : NO_PLACE);
  const [busy, setBusy] = useState(false);

  async function tag() {
    setBusy(true);
    try {
      const r = await fetch("/api/studio/print-queue/place", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ place: placeInput(v) }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't tag them. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : tag });
        return;
      }
      const j = await r.json();
      saved(j.place ? `Printing for ${j.place.name}` : "Not tagged to a place", j.place ? { description: `${j.tagged} ${j.tagged === 1 ? "code hangs" : "codes hang"} there now.` } : undefined);
      router.refresh();
    } catch (e) {
      failed(errorText(e, "Couldn't tag them. Try again."), { retry: tag });
    } finally { setBusy(false); }
  }

  return (
    <details className="box p-4 sm:p-5" open={!!current}>
      <summary className="t-card cursor-pointer">
        {current ? <>Printing for <Link href={`/studio/places/${current.id}`} className="text-scan">{current.name}</Link></> : "Printing these for a place?"}
      </summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="grid min-w-0 flex-1 gap-2 sm:max-w-[360px]">
          <PlacePicker places={places} partners={partners} value={v} onChange={setV} label="Place" noneLabel="No place" />
        </div>
        <button type="button" className="btn btn-sm" onClick={tag} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}Tag them all
        </button>
      </div>
      <p className="t-small mt-2">Every code in the queue hangs there, and scans say so.</p>
    </details>
  );
}
