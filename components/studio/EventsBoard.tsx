"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, MapPin, Trash2 } from "lucide-react";
import { readEvents, todayKey, writeEvents, type StudioEvent } from "./events-store";

const DABS = ["#7b2d8e", "#e8743b", "#2b37f0", "#0f7a55", "#ffd43b"];

function fmt(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function range(e: StudioEvent) {
  return e.end && e.end !== e.start ? `${fmt(e.start)} to ${fmt(e.end)}` : fmt(e.start);
}

export default function EventsBoard() {
  const [events, setEvents] = useState<StudioEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setEvents(readEvents()); setLoaded(true); }, []);

  function save(list: StudioEvent[]) {
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    setEvents(sorted);
    writeEvents(sorted);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name the event.");
    if (!start) return setError("Pick a start date.");
    if (end && end < start) return setError("End date is before the start.");
    save([...events, { id: Math.random().toString(36).slice(2, 10), name: name.trim(), venue: venue.trim(), start, end: end || start, createdAt: Date.now() }]);
    setName(""); setVenue(""); setStart(""); setEnd("");
  }

  const today = todayKey();
  const upcoming = events.filter((e) => (e.end || e.start) >= today);
  const past = events.filter((e) => (e.end || e.start) < today).reverse();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <form onSubmit={add} className="af-card grid gap-3 p-4 sm:p-5" noValidate>
        <h2 className="text-[22px] font-bold">New event</h2>
        <label className="af-field">
          <span className="label">Event name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="River Arts Market" required />
        </label>
        <label className="af-field">
          <span className="label">Venue</span>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} placeholder="Booth 14, Riverview Station" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="af-field">
            <span className="label">Starts</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="af-field">
            <span className="label">Ends</span>
            <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="text-[14px] font-semibold text-coral">{error}</p>}
        <button type="submit" className="btn btn-blue justify-self-start">Add event</button>
        <p className="flex items-center gap-2 border-t border-dashed border-line pt-3 text-[13px] text-ink-2">
          <span className="sticker-badge text-[11px]">Soon</span>
          Events sync to your codes soon. Saved on this device for now.
        </p>
      </form>

      <section className="grid gap-4" aria-labelledby="up-h">
        <h2 id="up-h" className="text-[22px] font-bold">Coming up</h2>
        {loaded && upcoming.length === 0 && (
          <div className="grid justify-items-start gap-2 rounded-[4px] border-2 border-dashed border-line bg-wall p-6">
            <i className="paint-dab h-8 w-8" style={{ ["--dab" as string]: "#7b2d8e" }} />
            <b className="font-display text-[24px] [font-variation-settings:'wdth'_80]">Nothing on the calendar.</b>
            <span className="text-[14px] text-ink-2">Add your next market or show.</span>
          </div>
        )}
        <ul className="grid gap-3">
          {upcoming.map((e, i) => <EventRow key={e.id} e={e} dab={DABS[i % DABS.length]} onDelete={() => save(events.filter((x) => x.id !== e.id))} live={e.start <= today} />)}
        </ul>
        {past.length > 0 && (
          <details className="text-[14px]">
            <summary className="cursor-pointer font-semibold text-ink-2">Past ({past.length})</summary>
            <ul className="mt-3 grid gap-2 opacity-70">
              {past.map((e) => <EventRow key={e.id} e={e} dab="#c9cbc0" onDelete={() => save(events.filter((x) => x.id !== e.id))} />)}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function EventRow({ e, dab, onDelete, live = false }: { e: StudioEvent; dab: string; onDelete: () => void; live?: boolean }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_2px_0_var(--af-line)]">
      <i className="paint-dab mt-1.5 h-4 w-4" style={{ ["--dab" as string]: dab }} />
      <div className="min-w-0 flex-1">
        <b className="block text-[16px]">{e.name} {live && <span className="sticker-badge ml-1 text-[11px]">On now</span>}</b>
        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] text-ink-2">
          <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" aria-hidden="true" />{range(e)}</span>
          {e.venue && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{e.venue}</span>}
        </span>
      </div>
      <button type="button" onClick={onDelete} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-coral" aria-label={`Remove ${e.name}`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
