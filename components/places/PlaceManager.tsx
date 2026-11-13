"use client";
// One Place (/studio/places/[id]): its paintings and codes, and the bulk moves. Print all its codes, move everything
// to another place, mark paintings as back home, and "This place closed / show ended" (pick what scans do; Undo for a
// few seconds).
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, DoorClosed, Home, Loader2, Printer, RotateCcw, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/studio/EmptyState";
import { Problem } from "@/components/studio/Problem";
import { errorText, failed, problemFrom, saved, withUndo } from "@/lib/feedback";
import { AFTER_END, type AfterEnd } from "@/lib/placeRules";
import PlacePicker, { NO_PLACE, placeInput, type PartnerChoice, type PlaceChoice, type PlaceValue } from "@/components/codes/PlacePicker";
import { PlaceFields, placeBody, type PartnerVenue, type PlaceFormValues } from "./PlaceForm";
import SmallDialog from "./SmallDialog";

export type ManagedPlace = {
  id: string; name: string; kind: string; area: string | null; venueId: string | null; startsOn: string | null; endsOn: string | null;
  active: boolean; afterEnd: string; ended: boolean; endedByDate: boolean; closedOn: string | null;
};
export type PlacePainting = { id: string; title: string; slug: string | null; imageUrl: string; since: string };
export type PlaceCode = { code: string; title: string; imageUrl: string | null; live: boolean; scans: number; discountPct: number | null; status: string };
export type HangChoice = { id: string; title: string; at: string | null };

const JSON_HEADERS = { "Content-Type": "application/json" };

async function call(url: string, body: unknown, method = "POST") {
  const r = await fetch(url, { method, headers: JSON_HEADERS, body: JSON.stringify(body) });
  if (!r.ok) throw Object.assign(new Error("request failed"), { problem: await problemFrom(r, "That didn't save. Try again.") });
  return r.json();
}
function fail(e: unknown, fallback: string, retry: () => void) {
  const p = (e as { problem?: { message: string; fix?: { label: string; href: string } } }).problem;
  if (p) failed(p.message, { fix: p.fix, retry: p.fix ? undefined : retry });
  else failed(errorText(e, fallback), { retry });
}

/** The header's main button: queue every code here (and one for each painting without a code), then the queue. */
export function PrintPlaceButton({ placeId, disabled }: { placeId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const j = await call(`/api/studio/places/${placeId}/queue`, {});
      saved(`${j.queued} ${j.queued === 1 ? "code" : "codes"} ready to print`, { description: j.made ? `Made ${j.made} new ${j.made === 1 ? "code" : "codes"} for paintings that had none.` : "Print at home or have us mail them." });
      router.push("/studio/qr/queue");
    } catch (e) {
      fail(e, "Couldn't add them to your print queue. Try again.", go);
    } finally { setBusy(false); }
  }
  return (
    <button type="button" className="btn btn-blue btn-sm" onClick={go} disabled={busy || disabled}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}Print all codes for this place
    </button>
  );
}

export default function PlaceManager({ place, paintings, codes, choices, others, partners, venues }: {
  place: ManagedPlace;
  paintings: PlacePainting[];
  codes: PlaceCode[];
  /** Paintings that could hang here (and where they hang now). */
  choices: HangChoice[];
  /** The artist's other Places, for "Move everything". */
  others: PlaceChoice[];
  partners: PartnerChoice[];
  /** Partner venues for the details form (this Place's own included). */
  venues: PartnerVenue[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState<"" | "close" | "move" | "delete">("");
  const [after, setAfter] = useState<AfterEnd>((place.afterEnd in AFTER_END ? place.afterEnd : "art") as AfterEnd);
  const [moveTo, setMoveTo] = useState<PlaceValue>(NO_PLACE);
  const [hang, setHang] = useState("");
  const initial: PlaceFormValues = { name: place.name, kind: place.kind, area: place.area || "", startsOn: place.startsOn || "", endsOn: place.endsOn || "", venueId: place.venueId || "" };
  const [v, setV] = useState<PlaceFormValues>(initial);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const formRef = useRef<HTMLFormElement>(null);
  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } finally { setBusy(""); } };

  // ---------------- closing ----------------
  function closePlace() {
    return run("close", async () => {
      try {
        // Already closed or past its dates: only what scans do changes.
        const j = await call(`/api/studio/places/${place.id}`, place.ended ? { afterEnd: after } : { active: false, afterEnd: after }, "PATCH");
        setDialog("");
        router.refresh();
        const was = j.before as { active: boolean; afterEnd: string };
        withUndo(place.ended ? `Scans now: ${AFTER_END[after].label.toLowerCase()}` : `${place.name} closed`, async () => {
          try {
            await call(`/api/studio/places/${place.id}`, { active: was.active, afterEnd: was.afterEnd }, "PATCH");
            saved("Put back", { description: place.ended ? undefined : `${place.name} is open again.` });
            router.refresh();
          } catch (e) { fail(e, "Couldn't undo that. Try again.", () => undefined); }
        }, { description: AFTER_END[after].label + ".", duration: 8000 });
      } catch (e) { fail(e, "Couldn't close it. Try again.", () => { void closePlace(); }); }
    });
  }
  function reopen() {
    return run("reopen", async () => {
      try {
        await call(`/api/studio/places/${place.id}`, place.endedByDate ? { active: true, endsOn: null } : { active: true }, "PATCH");
        saved(`${place.name} is open again`, { description: "Scans show “You scanned this at” again." });
        router.refresh();
      } catch (e) { fail(e, "Couldn't reopen it. Try again.", () => { void reopen(); }); }
    });
  }

  // ---------------- paintings ----------------
  function home(ids: string[] | null) {
    return run(ids ? `home-${ids[0]}` : "home-all", async () => {
      try {
        const back = ids ?? paintings.map((p) => p.id);
        const j = await call(`/api/studio/places/${place.id}/home`, ids ? { artworkIds: ids } : {});
        router.refresh();
        withUndo(`${j.moved} ${j.moved === 1 ? "painting" : "paintings"} back home`, async () => {
          try { await call("/api/studio/hangings", { artworkIds: back, place: { id: place.id } }); router.refresh(); } catch (e) { fail(e, "Couldn't undo that.", () => undefined); }
        });
      } catch (e) { fail(e, "Couldn't move them. Try again.", () => { void home(ids); }); }
    });
  }
  function hangHere() {
    if (!hang) return;
    return run("hang", async () => {
      try {
        await call("/api/studio/hangings", { artworkIds: [hang], place: { id: place.id } });
        const t = choices.find((c) => c.id === hang)?.title;
        setHang("");
        saved(`${t ?? "Painting"} hangs at ${place.name}`, { description: "Print its code with “Print all codes for this place”." });
        router.refresh();
      } catch (e) { fail(e, "Couldn't save that. Try again.", () => { void hangHere(); }); }
    });
  }

  // ---------------- everything ----------------
  function moveAll() {
    const to = placeInput(moveTo);
    if (!to) return;
    return run("move", async () => {
      try {
        const j = await call(`/api/studio/places/${place.id}/move`, { to });
        setDialog("");
        saved(`Moved to ${j.to.name}`, { description: `${j.codes} ${j.codes === 1 ? "code" : "codes"}, ${j.paintings} ${j.paintings === 1 ? "painting" : "paintings"}. Scans show the new place now.`, next: { label: `Open ${j.to.name}`, href: `/studio/places/${j.to.id}` } });
        router.refresh();
      } catch (e) { fail(e, "Couldn't move everything. Try again.", () => { void moveAll(); }); }
    });
  }
  function remove() {
    return run("delete", async () => {
      try {
        await call(`/api/studio/places/${place.id}`, {}, "DELETE");
        saved(`Deleted ${place.name}`, { description: codes.length ? "Its codes keep working." : undefined });
        router.push("/studio/places");
        router.refresh();
      } catch (e) { fail(e, "Couldn't delete it. Try again.", () => { void remove(); }); }
    });
  }
  function saveDetails(e: FormEvent) {
    e.preventDefault();
    if (!v.name.trim()) return;
    void run("details", async () => {
      try {
        await call(`/api/studio/places/${place.id}`, placeBody(v), "PATCH");
        saved("Saved", { description: v.name !== place.name ? "Scans show the new name now." : undefined });
        router.refresh();
      } catch (err) { fail(err, "Couldn't save. Try again.", () => formRef.current?.requestSubmit()); }
    });
  }

  const afterNow = AFTER_END[(place.afterEnd in AFTER_END ? place.afterEnd : "art") as AfterEnd];

  return (
    <div className="grid gap-5">
      {place.ended && (
        <Problem tone="info" title={place.active ? `Ended ${place.closedOn ?? ""}`.trim() : `Closed${place.closedOn ? ` ${place.closedOn}` : ""}`} fix={{ label: "Reopen", onClick: () => { void reopen(); } }} secondary={{ label: "Change what scans do", onClick: () => setDialog("close") }}>
          Scans: {afterNow.label.toLowerCase()}. Printed codes keep working.
        </Problem>
      )}

      <section aria-labelledby="paint-h" className="box grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="paint-h" className="t-card">Paintings here</h2>
          {paintings.length > 1 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void home(null); }} disabled={!!busy}>
              {busy === "home-all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Home className="h-4 w-4" aria-hidden="true" />}All back home
            </button>
          )}
        </div>
        {paintings.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {paintings.map((p) => (
              <li key={p.id} className="grid content-start gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imageUrl} alt="" className="aspect-[4/5] w-full rounded-xl object-cover" />
                {p.slug ? <Link href={`/studio/art/${p.slug}`} className="truncate text-[15px] font-bold text-ink no-underline hover:underline">{p.title}</Link> : <b className="truncate text-[15px]">{p.title}</b>}
                <span className="t-small">Since {p.since}</span>
                <button type="button" className="btn btn-ghost btn-sm justify-self-start" onClick={() => { void home([p.id]); }} disabled={!!busy} aria-label={`${p.title} is back home`}>
                  {busy === `home-${p.id}` ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Home className="h-4 w-4" aria-hidden="true" />}Back home
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-small">No paintings hanging here right now.</p>
        )}
        {choices.length > 0 && (
          <div className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
            <label className="af-field min-w-0 flex-1 sm:max-w-[360px]" htmlFor="hang-pick">
              <span className="label">Hang a painting here</span>
              <select id="hang-pick" value={hang} onChange={(e) => setHang(e.target.value)}>
                <option value="">Pick a painting</option>
                {choices.map((c) => <option key={c.id} value={c.id}>{c.title}{c.at ? ` (now at ${c.at})` : ""}</option>)}
              </select>
            </label>
            <button type="button" className="btn btn-sm" onClick={() => { void hangHere(); }} disabled={!hang || !!busy}>
              {busy === "hang" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Hang here
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="codes-h" className="box grid gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="codes-h" className="t-card">Codes here</h2>
          <Link href="/studio/codes" className="-my-3 inline-flex min-h-[44px] items-center text-[14px] font-bold text-scan">Move codes here from My codes</Link>
        </div>
        {codes.length ? (
          <ul className="grid gap-2">
            {codes.map((c) => (
              <li key={c.code}>
                <Link href={`/studio/codes/${c.code}`} className="flex items-center gap-3 rounded-xl px-1 py-1.5 text-ink no-underline hover:bg-wall/60">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-[3px] object-cover" />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[3px] bg-wall text-[12px] font-bold text-ink-2" aria-hidden="true">Page</span>
                  )}
                  <span className="grid min-w-0 flex-1">
                    <b className="truncate">{c.title}</b>
                    <span className="t-small">{c.code}{c.discountPct ? ` · ${c.discountPct}% off` : ""} · {c.status}</span>
                  </span>
                  <span className="num shrink-0 text-[14px] font-bold">{c.scans.toLocaleString("en-US")} <span className="font-normal text-ink-2">{c.scans === 1 ? "scan" : "scans"}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact dab="var(--af-scan)" title="No codes here yet" body="Pick codes on My codes and move them here, or hang a painting and print its code." action={{ label: "Open My codes", href: "/studio/codes" }} />
        )}
      </section>

      <details className="box group p-4 sm:p-5">
        <summary className="t-card cursor-pointer list-none">Details<span className="t-small ml-2 font-normal">Name, kind, dates, partner venue</span></summary>
        <form ref={formRef} onSubmit={saveDetails} className="mt-4 grid gap-4" noValidate>
          <PlaceFields v={v} set={(p) => setV((o) => ({ ...o, ...p }))} partners={venues} idp="pd" />
          <button type="submit" className="btn btn-sm justify-self-start" disabled={!dirty || !v.name.trim() || !!busy}>
            {busy === "details" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dirty ? "Save details" : "Saved"}
          </button>
        </form>
      </details>

      <section aria-labelledby="manage-h" className="box grid gap-3 p-4 sm:p-5">
        <h2 id="manage-h" className="t-card">When things change</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog("move")} disabled={!!busy || (!codes.length && !paintings.length)}>
            <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />Move everything to another place
          </button>
          {place.ended ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void reopen(); }} disabled={!!busy}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />Reopen
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDialog("close")} disabled={!!busy}>
              <DoorClosed className="h-4 w-4" aria-hidden="true" />This place closed / show ended
            </button>
          )}
        </div>
        <p className="t-small">Printed codes always keep working. You pick where their scans land.</p>
      </section>

      <div className="flex justify-start border-t border-line pt-4">
        <button type="button" className="btn btn-ghost btn-sm text-coral" onClick={() => setDialog("delete")} disabled={!!busy}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />Delete place
        </button>
      </div>

      {dialog === "close" && (
        <SmallDialog label={place.ended ? "What scans do now" : "This place closed or the show ended"} onClose={() => !busy && setDialog("")}>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void closePlace(); }}>
            <div className="grid gap-1">
              <h2 className="t-card">{place.ended ? "What should scans do now?" : `${place.name} closed?`}</h2>
              <p className="t-small">{codes.length ? `${codes.length} printed ${codes.length === 1 ? "code points" : "codes point"} here.` : "No codes here yet."} Pick where their scans land.</p>
            </div>
            <fieldset className="grid gap-2">
              <legend className="sr-only">Scans of its codes</legend>
              {(Object.keys(AFTER_END) as AfterEnd[]).map((k) => (
                <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${after === k ? "border-ink bg-wall/60" : "border-edge"}`}>
                  <input type="radio" name="after" value={k} checked={after === k} onChange={() => setAfter(k)} className="mt-1 h-5 w-5 accent-[rgb(var(--af-scan-rgb))]" />
                  <span className="grid gap-0.5"><b className="text-[15px]">{AFTER_END[k].label}</b><span className="t-small">{AFTER_END[k].sub}</span></span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-blue" disabled={!!busy}>
                {busy === "close" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{place.ended ? "Save" : "Close it"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDialog("")} disabled={!!busy}>Cancel</button>
            </div>
          </form>
        </SmallDialog>
      )}

      {dialog === "move" && (
        <SmallDialog label="Move everything to another place" onClose={() => !busy && setDialog("")}>
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); void moveAll(); }}>
            <div className="grid gap-1">
              <h2 className="t-card">Move everything from {place.name}</h2>
              <p className="t-small">{codes.length} {codes.length === 1 ? "code" : "codes"} and {paintings.length} {paintings.length === 1 ? "painting" : "paintings"}. Scans show the new place right away.</p>
            </div>
            <PlacePicker places={others} partners={partners} value={moveTo} onChange={setMoveTo} label="Move to" noneLabel="Pick a place" />
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-blue" disabled={!placeInput(moveTo) || !!busy}>
                {busy === "move" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Move everything
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDialog("")} disabled={!!busy}>Cancel</button>
            </div>
          </form>
        </SmallDialog>
      )}

      {dialog === "delete" && (
        <SmallDialog label={`Delete ${place.name}`} onClose={() => !busy && setDialog("")}>
          <div className="grid gap-4">
            <div className="grid gap-1">
              <h2 className="t-card">Delete {place.name}?</h2>
              <p className="t-small">Its codes keep working and stop naming it. Its paintings come home, and its history goes. To keep the history, close it instead.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={() => { void remove(); }} disabled={!!busy} data-autofocus>
                {busy === "delete" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Delete place
              </button>
              {!place.ended && <button type="button" className="btn btn-ghost" onClick={() => setDialog("close")} disabled={!!busy}>Close it instead</button>}
              <button type="button" className="btn btn-ghost" onClick={() => setDialog("")} disabled={!!busy}>Cancel</button>
            </div>
          </div>
        </SmallDialog>
      )}
    </div>
  );
}
