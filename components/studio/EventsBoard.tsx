"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { eventsApi, migrateLocalEvents, todayKey, type StudioEvent } from "./events-store";

const DABS = ["#7b2d8e", "#e8743b", "#2b37f0", "#0f7a55", "#ffd43b"];

function fmt(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const sortEvents = (list: StudioEvent[]) => [...list].sort((a, b) => a.start.localeCompare(b.start) || a.createdAt.localeCompare(b.createdAt));

function range(e: StudioEvent) {
  return e.end && e.end !== e.start ? `${fmt(e.start)} to ${fmt(e.end)}` : fmt(e.start);
}

export default function EventsBoard({ initial }: { initial: StudioEvent[] }) {
  const [events, setEvents] = useState<StudioEvent[]>(initial);
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One-time move of events an older version saved in this browser.
  useEffect(() => {
    let live = true;
    migrateLocalEvents(initial.length)
      .then((list) => {
        if (!live || !list) return;
        setEvents(sortEvents(list));
        toast.success(`Moved ${list.length} ${list.length === 1 ? "event" : "events"} from this browser to your account`);
      })
      .catch(() => {});
    return () => { live = false; };
  }, [initial.length]);

  function reset() {
    setName(""); setVenue(""); setStart(""); setEnd(""); setEditing(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Name the event.");
    if (!start) return setError("Pick a start date.");
    if (end && end < start) return setError("End date is before the start.");
    const fields = { name: name.trim(), venue: venue.trim(), start, end: end || start };
    setBusy(true);
    try {
      if (editing) {
        const updated = await eventsApi.update(editing, fields);
        setEvents((list) => sortEvents(list.map((x) => (x.id === updated.id ? updated : x))));
        toast.success("Event updated");
      } else {
        const created = await eventsApi.create(fields);
        setEvents((list) => sortEvents([...list, created]));
        toast.success("Event added");
      }
      reset();
    } catch (err: any) {
      setError(err.message || "Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(ev: StudioEvent) {
    const before = events;
    setEvents((list) => list.filter((x) => x.id !== ev.id));
    if (editing === ev.id) reset();
    try {
      await eventsApi.remove(ev.id);
    } catch (err: any) {
      setEvents(before);
      toast.error(err.message || "Could not remove it. Try again.");
    }
  }

  function edit(ev: StudioEvent) {
    setEditing(ev.id);
    setName(ev.name); setVenue(ev.venue); setStart(ev.start); setEnd(ev.end !== ev.start ? ev.end : "");
    setError(null);
  }

  const today = todayKey();
  const upcoming = events.filter((e) => (e.end || e.start) >= today);
  const past = events.filter((e) => (e.end || e.start) < today).reverse();

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
      <form onSubmit={submit} className="af-card grid gap-3 p-4 sm:p-5" noValidate>
        <h2 className="text-[22px] font-bold">{editing ? "Edit event" : "New event"}</h2>
        <label className="af-field">
          <span className="label">Event name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="River Arts Market" required />
        </label>
        <label className="af-field">
          <span className="label">Venue</span>
          <input value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={80} placeholder="Booth 14, Riverview Station" />
        </label>
        <div className="grid gap-3 min-[420px]:grid-cols-2">
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
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-blue" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Add event"}
          </button>
          {editing && <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>}
        </div>
        <p className="border-t border-dashed border-line pt-3 text-[13px] text-ink-2">
          Upcoming events show on your page under &ldquo;See it in person&rdquo;.
        </p>
      </form>

      <section className="grid gap-4" aria-labelledby="up-h">
        <h2 id="up-h" className="text-[22px] font-bold">Coming up</h2>
        {upcoming.length === 0 && (
          <div className="grid justify-items-start gap-2 rounded-[4px] border-2 border-dashed border-line bg-wall p-6">
            <i className="paint-dab h-8 w-8" style={{ ["--dab" as string]: "#7b2d8e" }} />
            <b className="font-display text-[24px] [font-variation-settings:'wdth'_80]">Nothing on the calendar.</b>
            <span className="text-[14px] text-ink-2">Add your next market or show.</span>
          </div>
        )}
        <ul className="grid gap-3">
          {upcoming.map((e, i) => <EventRow key={e.id} e={e} dab={DABS[i % DABS.length]} onEdit={() => edit(e)} onDelete={() => remove(e)} live={e.start <= today} />)}
        </ul>
        {past.length > 0 && (
          <details className="text-[14px]">
            <summary className="cursor-pointer font-semibold text-ink-2">Past ({past.length})</summary>
            <ul className="mt-3 grid gap-2 opacity-70">
              {past.map((e) => <EventRow key={e.id} e={e} dab="#c9cbc0" onEdit={() => edit(e)} onDelete={() => remove(e)} />)}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}

function EventRow({ e, dab, onEdit, onDelete, live = false }: { e: StudioEvent; dab: string; onEdit: () => void; onDelete: () => void; live?: boolean }) {
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
      <button type="button" onClick={onEdit} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink" aria-label={`Edit ${e.name}`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onDelete} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-coral" aria-label={`Remove ${e.name}`}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
