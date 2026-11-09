"use client";
// My codes (/studio/codes): every code, sortable and filterable (by Place, or labels out of date), with bulk select to
// move codes to a Place, reprint them, or mark their old labels as replaced.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, Loader2, MapPin, Printer, X } from "lucide-react";
import { EmptyState } from "@/components/studio/EmptyState";
import { SortMenu, useSortPref, type SortOption } from "@/components/studio/SortMenu";
import { errorText, failed, problemFrom, saved, withUndo } from "@/lib/feedback";
import PlacePicker, { NO_PLACE, placeInput, type PartnerChoice, type PlaceChoice, type PlaceValue } from "./PlacePicker";
import { queueReprint } from "./LabelWarning";
import { cn } from "@/lib/utils";

export type CodeListRow = {
  id: string; code: string; title: string; imageUrl: string | null; artTitle: string | null; createdAt: string; made: string;
  place: { id: string; name: string } | null; venue: string | null; discountPct: number | null;
  status: { text: string; on: boolean }; printed: string | null;
  /** The printed label disagrees with what scans show: what it says ("Prints from $55"), or null when it's fine. */
  stale: string | null;
  stats: { scans: number; scans7: number; visitors: number; sales: number; revenueCents: number; shareCents: number };
};

type SortKey = "newest" | "scans" | "sales" | "earned" | "name";
const SORTS: SortOption<SortKey>[] = [
  { value: "newest", label: "Newest" },
  { value: "scans", label: "Most scanned" },
  { value: "sales", label: "Most sales" },
  { value: "earned", label: "Most earned" },
  { value: "name", label: "Name A–Z" },
];
const SORT_KEYS = SORTS.map((s) => s.value);
const JSON_HEADERS = { "Content-Type": "application/json" };
const n = (v: number) => v.toLocaleString("en-US");
const usd = (c: number) => (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : "None yet");

function sortRows(list: CodeListRow[], sort: SortKey) {
  const out = [...list];
  const byNew = (a: CodeListRow, b: CodeListRow) => b.createdAt.localeCompare(a.createdAt);
  if (sort === "scans") out.sort((a, b) => b.stats.scans - a.stats.scans || byNew(a, b));
  else if (sort === "sales") out.sort((a, b) => b.stats.sales - a.stats.sales || byNew(a, b));
  else if (sort === "earned") out.sort((a, b) => b.stats.shareCents - a.stats.shareCents || byNew(a, b));
  else if (sort === "name") out.sort((a, b) => a.title.localeCompare(b.title, "en", { sensitivity: "base" }));
  else out.sort(byNew);
  return out;
}

function Thumb({ c }: { c: CodeListRow }) {
  return c.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={c.imageUrl} alt={c.artTitle || ""} className="h-14 w-14 shrink-0 rounded-[3px] object-cover shadow-[0_2px_0_var(--af-line)]" />
  ) : (
    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[3px] bg-wall text-center text-[12px] font-bold leading-tight text-ink-2 shadow-[0_2px_0_var(--af-line)]">Your<br />page</span>
  );
}

function Status({ c }: { c: CodeListRow }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-bold ${c.status.on ? "text-ink" : "text-ink-2"}`}>
      <i className="paint-dab h-2.5 w-2.5" style={{ ["--dab" as string]: c.status.on ? "#0f7a55" : "#b9bcc4" }} aria-hidden="true" />
      {c.status.text}
    </span>
  );
}

function Deal({ c }: { c: CodeListRow }) {
  const where = c.place?.name || c.venue;
  return (
    <span className="t-small flex flex-wrap items-center gap-1.5">
      <b className="text-ink">{c.code}</b>
      {where && <span>· {where}</span>}
      {c.discountPct ? <span className="rounded-full bg-sticker px-2 py-0.5 font-bold text-ink">{c.discountPct}% off</span> : null}
    </span>
  );
}

function Stale({ c }: { c: CodeListRow }) {
  if (!c.stale) return null;
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-coral/60 bg-coral/10 px-2 py-0.5 text-[12.5px] font-bold text-ink" title={`The printed label says “${c.stale}”`}>
      Label out of date
    </span>
  );
}

export default function CodesList({ rows, places, partners, initialShow }: { rows: CodeListRow[]; places: PlaceChoice[]; partners: PartnerChoice[]; initialShow?: string | null }) {
  const router = useRouter();
  const [sort, setSort] = useSortPref<SortKey>("studio-codes", "newest", SORT_KEYS);
  const staleCount = rows.filter((r) => r.stale).length;
  const placeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.place) m.set(r.place.id, (m.get(r.place.id) ?? 0) + 1);
    return m;
  }, [rows]);
  const showOptions: SortOption<string>[] = [
    { value: "all", label: `All codes (${rows.length})` },
    ...(staleCount || initialShow === "stale" ? [{ value: "stale", label: `Label out of date (${staleCount})` }] : []),
    ...places.filter((p) => placeCounts.has(p.id)).map((p) => ({ value: `place:${p.id}`, label: `${p.name} (${placeCounts.get(p.id)})` })),
    ...(rows.some((r) => !r.place) ? [{ value: "none", label: `No place (${rows.filter((r) => !r.place).length})` }] : []),
  ];
  const keys = showOptions.map((o) => o.value);
  const [showPref, setShowPref] = useSortPref<string>("studio-codes-show", "all", keys);
  // A link here (Studio home "printed labels show an old price") picks the filter; after that the menu does.
  const [linked, setLinked] = useState(initialShow && keys.includes(initialShow) ? initialShow : null);
  useEffect(() => { if (initialShow) setLinked(initialShow); }, [initialShow]);
  const show = linked && keys.includes(linked) ? linked : keys.includes(showPref) ? showPref : "all";
  const setShow = (v: string) => { setLinked(null); setShowPref(v); };

  const visible = useMemo(() => {
    const list = show === "stale" ? rows.filter((r) => r.stale)
      : show === "none" ? rows.filter((r) => !r.place)
      : show.startsWith("place:") ? rows.filter((r) => r.place?.id === show.slice(6))
      : rows;
    return sortRows(list, sort);
  }, [rows, show, sort]);

  // Bulk: pick codes, then move them to a Place, reprint them or mark their labels replaced.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<PlaceValue>(NO_PLACE);
  const [busy, setBusy] = useState<"" | "move" | "reprint" | "replaced">("");
  const toggle = (code: string) => setPicked((o) => { const s = new Set(o); if (s.has(code)) s.delete(code); else s.add(code); return s; });
  const pickedRows = rows.filter((r) => picked.has(r.code));
  const pickedStale = pickedRows.filter((r) => r.stale).map((r) => r.code);
  const allPicked = visible.length > 0 && visible.every((r) => picked.has(r.code));
  const done = () => { setPicked(new Set()); setSelecting(false); router.refresh(); };

  async function move() {
    const codes = Array.from(picked);
    if (!codes.length) return;
    setBusy("move");
    try {
      const r = await fetch("/api/studio/codes/place", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ codes, place: placeInput(target) }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't move them. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : move });
        return;
      }
      const j = await r.json();
      done();
      withUndo(j.place ? `${j.moved} ${j.moved === 1 ? "code" : "codes"} now at ${j.place.name}` : `${j.moved} ${j.moved === 1 ? "code" : "codes"} out of their place`, async () => {
        await fetch("/api/studio/codes/place", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ restore: j.before }) });
        router.refresh();
      }, { description: "Scans show the new place right away." });
    } catch (e) {
      failed(errorText(e, "Couldn't move them. Try again."), { retry: move });
    } finally { setBusy(""); }
  }

  async function reprint(codes: string[]) {
    setBusy("reprint");
    try {
      const q = await queueReprint(codes);
      saved(`${q.queued} ${q.queued === 1 ? "code" : "codes"} added to your print queue`, { description: "Same look, today's price. Mark the old labels replaced once the new ones are up.", next: { label: "Open print queue", href: "/studio/qr/queue" } });
      done();
    } catch (e) {
      failed(errorText(e, "Couldn't add them to your print queue. Try again."), { retry: () => { void reprint(codes); } });
    } finally { setBusy(""); }
  }

  async function replaced(codes: string[]) {
    setBusy("replaced");
    try {
      const r = await fetch("/api/studio/code-prints/replaced", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ codes }) });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't mark them. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => { void replaced(codes); } });
        return;
      }
      const { ids } = await r.json();
      done();
      withUndo(`Old labels marked as replaced`, async () => {
        await fetch("/api/studio/code-prints/replaced", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ undo: ids }) });
        router.refresh();
      });
    } catch (e) {
      failed(errorText(e, "Couldn't mark them. Try again."), { retry: () => { void replaced(codes); } });
    } finally { setBusy(""); }
  }

  const pick = (c: CodeListRow) => selecting && (
    <input type="checkbox" checked={picked.has(c.code)} onChange={() => toggle(c.code)} className="h-6 w-6 shrink-0 accent-[rgb(var(--af-scan-rgb))]" aria-label={`Select ${c.title} (${c.code})`} />
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {selecting ? (
          <>
            <span className="t-muted mr-auto font-semibold">Pick codes</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked(allPicked ? new Set() : new Set(visible.map((r) => r.code)))}>
              <Check className="h-4 w-4" aria-hidden="true" />{allPicked ? "Clear all" : `All shown (${visible.length})`}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSelecting(false); setPicked(new Set()); }}>
              <X className="h-4 w-4" aria-hidden="true" />Cancel
            </button>
          </>
        ) : (
          <>
            <SortMenu label="Sort" value={sort} onChange={setSort} options={SORTS} />
            {showOptions.length > 1 && <SortMenu label="Show" kind="filter" value={show} onChange={setShow} options={showOptions} />}
            <button type="button" className="btn btn-ghost btn-sm ml-auto min-h-[40px]" onClick={() => setSelecting(true)} title="Pick codes to move to a place, reprint or mark replaced">
              <CheckSquare className="h-4 w-4" aria-hidden="true" />Select
            </button>
          </>
        )}
      </div>

      {show === "stale" && staleCount > 0 && !selecting && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-sticker bg-sticker/20 px-4 py-3" role="status">
          <p className="min-w-0 flex-1 text-[15px] font-semibold">
            {staleCount} printed {staleCount === 1 ? "label shows" : "labels show"} an old price, discount or title.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => reprint(rows.filter((r) => r.stale).map((r) => r.code))}>
              {busy === "reprint" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Printer className="h-4 w-4" aria-hidden="true" />}Reprint all
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => replaced(rows.filter((r) => r.stale).map((r) => r.code))}>
              {busy === "replaced" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Mark all replaced
            </button>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState compact dab="#2b37f0" title={show === "stale" ? "Every printed label is up to date" : "Nothing here"} body={show === "stale" ? "When a price, discount or title changes after printing, the code shows up here." : "No codes match this filter."} action={{ label: "Show all codes", onClick: () => setShow("all") }} />
      ) : (
        <>
          {/* Phones: cards */}
          <ul className="grid gap-3 md:hidden" aria-label="Codes">
            {visible.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                {pick(c)}
                <Link href={`/studio/codes/${c.code}`} className={cn("af-card grid min-w-0 flex-1 gap-3 p-4 text-ink no-underline", picked.has(c.code) && "border-scan")}>
                  <div className="flex items-start gap-3">
                    <Thumb c={c} />
                    <div className="grid min-w-0 flex-1 gap-1">
                      <b className="t-card truncate">{c.title}</b>
                      <Deal c={c} />
                      {c.printed && <span className="text-[13px] font-semibold text-ink-2">{c.printed}</span>}
                      <Stale c={c} />
                    </div>
                    <Status c={c} />
                  </div>
                  <dl className="grid grid-cols-4 gap-2 border-t border-line pt-3 text-center">
                    {([["scans", n(c.stats.scans)], ["7 days", n(c.stats.scans7)], ["sales", n(c.stats.sales)], ["earned", usd(c.stats.shareCents)]] as const).map(([l, v], i) => (
                      <div key={l} className="grid gap-0.5">
                        <dd className={`num text-[16px] font-bold ${i === 3 ? "text-earned" : ""}`}>{v}</dd>
                        <dt className="text-[13px] text-ink-2">{l}</dt>
                      </div>
                    ))}
                  </dl>
                </Link>
              </li>
            ))}
          </ul>

          {/* Wider: a table */}
          <div className="af-card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-[14px]">
              <caption className="sr-only">Your codes and what they did</caption>
              <thead className="border-b border-line text-[13px] text-ink-2">
                <tr>
                  {selecting && <th scope="col" className="w-10 pl-4"><span className="sr-only">Select</span></th>}
                  <th scope="col" className="px-4 py-3 font-semibold">Code</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Scans</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">7 days</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">People</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Sales</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Revenue</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">You earned</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Converts</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className={cn("border-b border-line last:border-0 hover:bg-wall/60", picked.has(c.code) && "bg-scan-soft/60")}>
                    {selecting && <td className="pl-4">{pick(c)}</td>}
                    <td className="px-4 py-3">
                      <Link href={`/studio/codes/${c.code}`} className="flex items-center gap-3 text-ink no-underline">
                        <Thumb c={c} />
                        <span className="grid min-w-0 gap-0.5">
                          <b className="max-w-[260px] truncate">{c.title}</b>
                          <Deal c={c} />
                          <span className="text-[13px] text-ink-2">Made {c.made}</span>
                          {c.printed && <span className="text-[13px] font-semibold text-ink-2">{c.printed}</span>}
                          <Stale c={c} />
                        </span>
                      </Link>
                    </td>
                    <td className="num px-3 py-3 text-right font-bold">{n(c.stats.scans)}</td>
                    <td className="num px-3 py-3 text-right">{n(c.stats.scans7)}</td>
                    <td className="num px-3 py-3 text-right">{n(c.stats.visitors)}</td>
                    <td className="num px-3 py-3 text-right">{n(c.stats.sales)}</td>
                    <td className="num px-3 py-3 text-right">{usd(c.stats.revenueCents)}</td>
                    <td className="num px-3 py-3 text-right font-bold text-earned">{usd(c.stats.shareCents)}</td>
                    <td className="num px-3 py-3 text-right">{pct(c.stats.sales, c.stats.scans)}</td>
                    <td className="px-4 py-3"><Status c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selecting && (
        <div className="sticky bottom-3 z-20 grid gap-3 rounded-2xl border border-edge bg-white p-3 shadow-[0_10px_30px_-10px_rgba(21,22,27,.35)] sm:flex sm:flex-wrap sm:items-end" role="region" aria-label="Selected codes">
          <b className="num text-[15px] sm:self-center" aria-live="polite">{picked.size} selected</b>
          <div className="grid min-w-0 gap-2 sm:w-[260px]">
            <PlacePicker places={places} partners={partners} value={target} onChange={setTarget} label="Move to" noneLabel="No place (take them out)" />
          </div>
          <button type="button" className="btn btn-blue btn-sm" disabled={!picked.size || !!busy} onClick={move}>
            {busy === "move" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPin className="h-4 w-4" aria-hidden="true" />}Move
          </button>
          {pickedStale.length > 0 && (
            <span className="flex flex-wrap gap-2 sm:ml-auto">
              <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => reprint(pickedStale)}>
                <Printer className="h-4 w-4" aria-hidden="true" />Reprint {pickedStale.length}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => replaced(pickedStale)}>Mark replaced</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
