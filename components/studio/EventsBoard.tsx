"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { errorText, failed, saved } from "@/lib/feedback";
import { EmptyState } from "./EmptyState";
import { Problem } from "./Problem";
import { CalendarDays, Loader2, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { eventsApi, migrateLocalEvents, todayKey, type StudioEvent } from "./events-store";
import LocationInput from "@/components/forms/LocationInput";
import { recall, remember } from "@/lib/smartFields";

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
  // The last venue used, offered as a one-tap fill (most artists do the same market every week).
  const [lastVenue, setLastVenue] = useState<string | null>(null);
  useEffect(() => setLastVenue(recall<string>("event-venue")), []);
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState<{ message: string; fix?: { label: string; onClick: () => void } } | null>(null);
  const setError = (message: string | null, fix?: { label: string; onClick: () => void }) => setErrorState(message ? { message, fix } : null);
  const formRef = useRef<HTMLFormElement>(null);
  const focus = (id: string) => ({ label: "Show me", onClick: () => document.getElementById(id)?.focus() });
  const startNew = () => { const el = document.getElementById("event-name"); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.focus(); };

  // One-time move of events an older version saved in this browser.
  useEffect(() => {
    let live = true;
    migrateLocalEvents(initial.length)
      .then((list) => {
        if (!live || !list) return;
        setEvents(sortEvents(list));
        saved(`Moved ${list.length} ${list.length === 1 ? "event" : "events"} from this browser to your account`);
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
    if (!name.trim()) { setError("Name the event.", focus("event-name")); document.getElementById("event-name")?.focus(); return; }
    if (!start) { setError("Pick a start date.", focus("event-start")); document.getElementById("event-start")?.focus(); return; }
    if (end && end < start) { setError("End date is before the start.", focus("event-end")); document.getElementById("event-end")?.focus(); return; }
    const fields = { name: name.trim(), venue: venue.trim(), start, end: end || start };
    if (fields.venue) { remember("event-venue", fields.venue); setLastVenue(fields.venue); }
    setBusy(true);
    try {
      if (editing) {
        const updated = await eventsApi.update(editing, fields);
        setEvents((list) => sortEvents(list.map((x) => (x.id === updated.id ? updated : x))));
        saved("Event updated");
      } else {
        const created = await eventsApi.create(fields);
        setEvents((list) => sortEvents([...list, created]));
        saved("Event added", { description: "It shows on your page under \u201cSee it in person\u201d." });
      }
      reset();
    } catch (err) {
      setError(errorText(err, "Could not save. Try again."), { label: "Try again", onClick: () => formRef.current?.requestSubmit() });
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
      saved(`Removed ${ev.name}`);
    } catch (err) {
      setEvents(before);
      failed(errorText(err, "Could not remove it. Try again."), { retry: () => { void remove(ev); } });
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
      <form ref={formRef} onSubmit={submit} className="af-card grid gap-3 p-4 sm:p-5" noValidate>
        <h2 className="text-[22px] font-bold">{editing ? "Edit event" : "New event"}</h2>
        <label className="af-field">
          <span className="label">Event name</span>
          <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Brooklyn Flea" required />
        </label>
        <LocationInput
          label="Where"
          name="venue"
          scope="nyc"
          tail
          autoComplete="off"
          value={venue}
          onChange={setVenue}
          hint={!venue && lastVenue && !editing ? (
            <button type="button" onClick={() => setVenue(lastVenue)} className="font-semibold text-scan underline-offset-2 hover:underline">
              Same as last time: {lastVenue}
            </button>
          ) : undefined}
          maxLength={80}
          placeholder="Booth 14, DUMBO, Brooklyn"
        />
        <div className="grid gap-3 min-[420px]:grid-cols-2">
          <label className="af-field">
            <span className="label">Starts</span>
            <input id="event-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="af-field">
            <span className="label">Ends</span>
            <input id="event-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        {error && <Problem tone="error" title={error.message} fix={error.fix} />}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="btn btn-blue" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{editing ? "Save changes" : "Add event"}
          </button>
          {editing && <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>}
        </div>
        <p className="border-t border-dashed border-line pt-3 text-[13px] text-ink-2">
          Shows on your page under &ldquo;See it in person&rdquo;.
        </p>
      </form>

      {/* With events on the calendar, phones see them first; with none, the form leads. */}
      <section className={upcoming.length ? "grid gap-4 max-lg:order-first" : "grid gap-4"} aria-labelledby="up-h">
        <div className="flex items-center justify-between gap-3">
          <h2 id="up-h" className="text-[22px] font-bold">Coming up</h2>
          {upcoming.length > 0 && (
            <button type="button" onClick={startNew} className="inline-flex min-h-[40px] items-center gap-1 text-[14px] font-bold text-scan lg:hidden">
              <Plus className="h-4 w-4" aria-hidden="true" />Add event
            </button>
          )}
        </div>
        {upcoming.length === 0 && (
          <EmptyState
            compact
            dab="#7b2d8e"
            title="Nothing on the calendar"
            body="Add your next market or show. Tag codes with it to see what sold there."
            secondary={{ label: "Print codes for it", href: "/studio/qr" }}
          />
        )}
        <ul className="grid gap-3">
          {upcoming.map((e, i) => <EventRow key={e.id} e={e} dab={DABS[i % DABS.length]} onEdit={() => edit(e)} onDelete={() => remove(e)} live={e.start <= today} />)}
        </ul>
        {past.length > 0 && (
          <details className="text-[14px]">
            <summary className="inline-flex min-h-[40px] cursor-pointer items-center font-semibold text-ink-2">Past ({past.length})</summary>
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
      <button type="button" onClick={onEdit} className="-my-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink" aria-label={`Edit ${e.name}`} title="Edit">
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </button>
      <button type="button" onClick={onDelete} className="-my-1 grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-coral" aria-label={`Remove ${e.name}`} title="Remove">
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </li>
  );
}
