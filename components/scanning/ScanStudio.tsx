"use client";
// /studio/scanning: book a painting scan (pick pieces, sizes, drop-off or NYC pickup, dates; live estimate) and follow
// each booking through requested → confirmed (pay) → paid → scanning → delivered → returned, with the next step and its
// button on every state. Server side: lib/scanning.server.ts.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { Problem } from "@/components/studio/Problem";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { PRINT_SIZES, SIZE_LABEL, sizeInches, type PrintSize } from "@/components/art/pricing";
import {
  HANDOFF_LABEL, ITEM_BANDS, MAX_SCAN_PIECES, STATUS_DAB, STATUS_LABEL, STATUS_STEPS, bandLabel, bandRange, dayLabel, estimate, estimateText, oversizedRange, usd,
  type Handoff, type ItemBand, type ScanBand, type ScanStatus,
} from "@/lib/scanning";
import { cn } from "@/lib/utils";

export type ScanArt = {
  id: string; slug: string; title: string; imageUrl: string; printableSizes: string[];
  /** Too small for the biggest print size. */
  limited: boolean;
  /** Already in an open booking. */
  busy: boolean;
  original: string | null;
  band: ItemBand | null;
};
export type ScanBookingView = {
  id: string; status: ScanStatus; handoff: Handoff; pickupAddress: string | null; preferredDates: string[]; notes: string | null;
  estimateCents: number | null; priceCents: number | null; scheduledFor: string | null; dropoffInfo: string | null; createdAt: string;
  receivedAt: string | null; paidAt: string | null; deliveredAt: string | null; returnedAt: string | null; cancelReason: string | null; test: boolean;
  items: { id: string; band: string; title: string | null; slug: string | null; imageUrl: string | null; printableSizes: string[]; delivered: boolean }[];
};
type Settings = { bands: ScanBand[]; pickupFeeCents: number | null; turnaroundDays: number; returnDays: number; care: string };
type Fix = { label: string; href?: string; onClick?: () => void };
type Group = { key: string; count: number; band: ItemBand };

const largest = (sizes: string[]) => [...PRINT_SIZES].reverse().find((s) => sizes.includes(s)) as PrintSize | undefined;
const focusEl = (id: string) => { const el = document.getElementById(id); el?.scrollIntoView({ behavior: "smooth", block: "center" }); (el?.matches("input,textarea,button,select") ? el : el?.querySelector<HTMLElement>("input,textarea,button,select"))?.focus(); };

export default function ScanStudio({ enabled, arts, bookings, preselect, focus, justPaid, settings }: {
  enabled: boolean; arts: ScanArt[]; bookings: ScanBookingView[]; preselect: string | null; focus: string | null; justPaid: string | null; settings: Settings;
}) {
  // No bookings yet, or a deep link to one piece (?art=): straight to the form, no intro card to click through.
  const [formOpen, setFormOpen] = useState(enabled && (!!preselect || bookings.length === 0));
  const formRef = useRef<HTMLDivElement>(null);
  const openForm = () => { setFormOpen(true); requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };

  useEffect(() => {
    if (focus) document.getElementById(`booking-${focus}`)?.scrollIntoView({ block: "center" });
    else if (preselect) formRef.current?.scrollIntoView({ block: "start" });
  }, [focus, preselect]);

  // A booking just went in (the list grew): close the form and show it.
  const seen = useRef(bookings.length);
  useEffect(() => {
    if (bookings.length > seen.current) setFormOpen(false);
    seen.current = bookings.length;
  }, [bookings.length]);
  const paid = justPaid ? bookings.find((b) => b.id === justPaid) : null;

  return (
    <div className="grid gap-8">
      {paid && paid.paidAt && (
        <Problem tone="success" title={`Paid — you're booked for ${paid.scheduledFor ? dayLabel(paid.scheduledFor.slice(0, 10)) : "the confirmed date"}${paid.test ? " (test payment)" : ""}`} fix={{ label: "See next steps", onClick: () => focusEl(`booking-${paid.id}`) }}>
          We emailed you the details. {paid.handoff === "pickup" ? "We'll come to you." : "Bring the paintings on the day."}
        </Problem>
      )}

      {bookings.length > 0 && (
        <section id="bookings" aria-labelledby="bookings-h" className="grid gap-3 scroll-mt-24">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="bookings-h" className="text-[20px] font-bold">Your bookings</h2>
            {enabled && !formOpen && <button type="button" onClick={openForm} className="btn btn-blue btn-sm">Book another scan</button>}
          </div>
          <ul className="grid gap-4">
            {bookings.map((b) => <BookingCard key={b.id} b={b} settings={settings} highlight={b.id === focus} onBookAgain={enabled ? openForm : undefined} />)}
          </ul>
        </section>
      )}

      {enabled && formOpen && (
        <div ref={formRef} className="scroll-mt-24">
          <BookingForm
            arts={arts} preselect={preselect} settings={settings} first={bookings.length === 0}
            onClose={bookings.length ? () => setFormOpen(false) : undefined}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Booking form ----------

function BookingForm({ arts, preselect, settings, first, onClose }: {
  arts: ScanArt[]; preselect: string | null; settings: Settings;
  /** First booking: one line on what this is, in place of an intro card. */
  first: boolean; onClose?: () => void;
}) {
  const router = useRouter();
  const startBand = (a: ScanArt | undefined) => a?.band ?? null;
  const [picked, setPicked] = useState<Map<string, ItemBand | null>>(() => {
    const a = preselect ? arts.find((x) => x.id === preselect && !x.busy) : undefined;
    return a ? new Map([[a.id, startBand(a)]]) : new Map();
  });
  const [groups, setGroups] = useState<Group[]>([]);
  const [handoff, setHandoff] = useState<Handoff>("dropoff");
  const [address, setAddress] = useState("");
  const [dates, setDates] = useState<string[]>(["", "", ""]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState<{ message: string; fix?: Fix } | null>(null);
  const setError = (message: string | null, fix?: Fix) => setErrorState(message ? { message, fix } : null);
  const [minDay] = useState(() => { const d = new Date(Date.now() + 86400000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });

  // Pieces that most need a scan first.
  const sorted = useMemo(() => [...arts].sort((a, b) => Number(b.limited) - Number(a.limited)), [arts]);
  const byId = useMemo(() => new Map(arts.map((a) => [a.id, a])), [arts]);
  const items = [
    ...Array.from(picked.values()).filter((band): band is ItemBand => !!band).map((band) => ({ band })),
    ...groups.flatMap((g) => Array.from({ length: g.count }, () => ({ band: g.band }))),
  ];
  const pieces = picked.size + groups.reduce((n, g) => n + g.count, 0);
  const est = estimate(items as { band: ItemBand }[], handoff, settings);
  const unsized = Array.from(picked.entries()).filter(([, b]) => !b).map(([id]) => id);

  const toggle = (a: ScanArt) => setPicked((m) => { const n = new Map(m); if (n.has(a.id)) n.delete(a.id); else n.set(a.id, startBand(a)); return n; });
  const setBand = (id: string, band: ItemBand) => setPicked((m) => new Map(m).set(id, band));
  const addGroup = () => setGroups((g) => (g.length >= 4 ? g : [...g, { key: String(Date.now()), count: 1, band: "medium" }]));
  const patchGroup = (key: string, p: Partial<Group>) => setGroups((g) => g.map((x) => (x.key === key ? { ...x, ...p } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pieces) { setError("Pick at least one painting, or add pieces you haven't uploaded yet.", { label: "Pick paintings", onClick: () => focusEl("scan-pick") }); return; }
    if (pieces > MAX_SCAN_PIECES) { setError(`Up to ${MAX_SCAN_PIECES} paintings per booking. Book the rest separately.`, { label: "Change paintings", onClick: () => focusEl("scan-pick") }); return; }
    if (unsized.length) { const t = byId.get(unsized[0])?.title; setError(`Pick a size for ${t}.`, { label: "Pick a size", onClick: () => focusEl(`size-${unsized[0]}`) }); return; }
    if (handoff === "pickup" && !/\b1(?:0[0-4]|1[0-6])\d{2}\b/.test(address)) {
      setError(address.trim() ? "Pickup is for the five NYC boroughs. Add a NYC ZIP code, or choose drop-off." : "Add the pickup address, with the ZIP code.", { label: "Fix address", onClick: () => focusEl("scan-address") });
      return;
    }
    const chosen = dates.filter(Boolean);
    if (!chosen.length) { setError("Pick at least one day that works for you.", { label: "Pick a day", onClick: () => focusEl("scan-date-0") }); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/studio/scanning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworks: Array.from(picked.entries()).map(([artworkId, band]) => ({ artworkId, band })),
          newPieces: groups.map(({ band, count }) => ({ band, count })),
          handoff, pickupAddress: address, preferredDates: chosen, notes,
        }),
      });
      if (!res.ok) {
        const p = await problemFrom(res, "We couldn't send that booking. Try again.");
        const fix: Fix | undefined =
          p.code === "scan_pickup_nyc" || p.code === "scan_pickup_address" ? { label: "Fix address", onClick: () => focusEl("scan-address") }
            : p.code === "scan_dates" ? { label: "Pick a day", onClick: () => focusEl("scan-date-0") }
              : p.code?.startsWith("scan_") ? { label: "Change paintings", onClick: () => focusEl("scan-pick") }
                : p.fix ?? { label: "Try again", onClick: () => setError(null) };
        setError(p.message, fix);
        failed(p.message, { fix: p.fix });
        return;
      }
      const { id } = (await res.json()) as { id: string };
      saved("Booking requested", { description: "We'll email you to confirm the date and the final price." });
      router.push(`/studio/scanning?booking=${id}`, { scroll: false });
      router.refresh();
    } catch (err) {
      const msg = errorText(err, "We couldn't send that booking. Try again.");
      setError(msg, { label: "Try again", onClick: () => setError(null) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10" aria-labelledby="book-h">
      <div className="grid min-w-0 gap-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="book-h" className="display text-[34px]">Book a scan</h2>
          {onClose && <button type="button" onClick={onClose} className="text-[14px] font-semibold text-ink-2 underline-offset-2 hover:text-ink hover:underline">Close</button>}
        </div>
        {first && (
          <p className="-mt-4 text-[15px] text-ink-2">
            Free to book. We confirm the date and price, then you pay.{" "}
            <Link href="/scanning#prices" className="font-semibold text-scan underline-offset-2 hover:underline">See prices</Link>
          </p>
        )}

        {/* 1. Paintings */}
        <section id="scan-pick" aria-labelledby="pick-h" className="grid gap-3 scroll-mt-24">
          <h3 id="pick-h" className="flex items-baseline gap-2 text-[20px] font-bold"><i className="paint-dab" style={{ ["--dab" as string]: "var(--af-scan)" }} />Which paintings?</h3>
          {sorted.length ? (
            <>
              <p className="-mt-1 text-[13.5px] text-ink-2">Tap to add. Pieces that can&apos;t print at {SIZE_LABEL.xl} yet come first.</p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                {sorted.map((a) => {
                  const on = picked.has(a.id);
                  const top = largest(a.printableSizes);
                  return (
                    <li key={a.id}>
                      <button
                        type="button" onClick={() => toggle(a)} disabled={a.busy} aria-pressed={on}
                        className={cn("group relative grid w-full gap-1.5 rounded-xl p-1.5 text-left transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-scan-soft ring-2 ring-scan" : "hover:bg-wall")}
                      >
                        <span className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-gallery p-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.imageUrl} alt="" className="max-h-full max-w-full bg-white object-contain shadow-[0_6px_14px_-4px_rgba(21,22,27,.4)]" />
                          <span className={cn("absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full", on ? "bg-ink text-white" : "bg-white/90 text-ink opacity-0 transition group-hover:opacity-100")}>
                            {on ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                          </span>
                        </span>
                        <span className="truncate px-0.5 text-[13.5px] font-semibold">{a.title}</span>
                        <span className={cn("px-0.5 text-[12px] font-semibold", a.busy ? "text-ink-2" : a.limited ? "text-coral" : "text-ink-2")}>
                          {a.busy ? "Already booked" : a.limited ? `Prints up to ${top ? SIZE_LABEL[top] : "—"} only` : a.printableSizes.length ? "Prints every size" : "Sizes not checked"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="rounded-xl border-2 border-dashed border-line bg-wall px-4 py-5 text-[14.5px] text-ink-2">
              No art on your page yet, and that&apos;s fine: add the paintings below as &ldquo;not uploaded yet&rdquo;. Or <Link href="/studio/art/new" className="font-semibold text-scan underline">upload a phone photo first</Link>.
            </p>
          )}

          {picked.size > 0 && (
            <ul className="grid gap-2.5" aria-label="Size of each painting">
              {Array.from(picked.entries()).map(([id, band]) => {
                const a = byId.get(id);
                if (!a) return null;
                return (
                  <li key={id} className="af-panel grid gap-2.5 p-3 sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl} alt="" className="hidden h-14 w-14 rounded-[2px] bg-white object-cover sm:block" />
                    <div className="grid gap-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <b className="truncate">{a.title}{a.original && <span className="num ml-2 text-[12.5px] font-normal text-ink-2">original {a.original}</span>}</b>
                        <button type="button" onClick={() => toggle(a)} className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink" aria-label={`Remove ${a.title}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</button>
                      </div>
                      <BandPicker id={`size-${id}`} name={`band-${id}`} label={`Size of ${a.title}`} value={band} onChange={(b) => setBand(id, b)} settings={settings} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="grid gap-2.5">
            {groups.map((g, i) => (
              <div key={g.key} className="af-panel grid gap-2.5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="flex items-center gap-2"><ImageOff className="h-4 w-4 text-ink-2" aria-hidden="true" />Not uploaded yet</b>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center rounded-full border-[1.5px] border-line bg-white" role="group" aria-label={`How many, group ${i + 1}`}>
                      <button type="button" className="grid h-10 w-10 place-items-center" onClick={() => patchGroup(g.key, { count: Math.max(1, g.count - 1) })} aria-label="One fewer"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                      <span className="num min-w-[2ch] text-center font-bold" aria-live="polite">{g.count}</span>
                      <button type="button" className="grid h-10 w-10 place-items-center" onClick={() => patchGroup(g.key, { count: Math.min(MAX_SCAN_PIECES, g.count + 1) })} aria-label="One more"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                    </span>
                    <button type="button" onClick={() => setGroups((x) => x.filter((y) => y.key !== g.key))} className="flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink" aria-label="Remove these pieces"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove</button>
                  </div>
                </div>
                <BandPicker id={`group-${g.key}`} name={`group-${g.key}`} label="About how big?" value={g.band} onChange={(band) => patchGroup(g.key, { band })} settings={settings} />
              </div>
            ))}
            {groups.length < 4 && (
              <button type="button" onClick={addGroup} className="btn btn-ghost btn-sm justify-self-start"><Plus className="h-4 w-4" aria-hidden="true" />{groups.length ? "Add pieces of another size" : "Add pieces not uploaded yet"}</button>
            )}
          </div>
        </section>

        {/* 2. Handoff */}
        <section aria-labelledby="handoff-h" className="grid gap-3">
          <h3 id="handoff-h" className="flex items-baseline gap-2 text-[20px] font-bold"><i className="paint-dab" style={{ ["--dab" as string]: "var(--af-sticker)" }} />Drop-off or pickup</h3>
          <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Drop-off or pickup">
            {(["dropoff", "pickup"] as Handoff[]).map((h) => (
              <label key={h} className={cn("grid cursor-pointer gap-1 rounded-xl border-2 bg-white p-3.5 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", handoff === h ? "border-ink" : "border-line hover:border-ink-2")}>
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold"><input type="radio" name="handoff" checked={handoff === h} onChange={() => setHandoff(h)} className="h-4 w-4 accent-[#2b37f0]" />{HANDOFF_LABEL[h]}</span>
                  <span className="num text-[13.5px] font-semibold">{h === "dropoff" ? "Free" : settings.pickupFeeCents != null ? (settings.pickupFeeCents ? `+${usd(settings.pickupFeeCents)}` : "Free") : "Fee quoted"}</span>
                </span>
                <span className="text-[13px] text-ink-2">{h === "dropoff" ? "Bring them to our NYC studio. We send the address when we confirm." : "We collect from anywhere in the five boroughs."}</span>
              </label>
            ))}
          </div>
          {handoff === "pickup" && (
            <label className="af-field">
              <span className="label">Pickup address, with ZIP</span>
              <textarea id="scan-address" name="street-address" rows={2} maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder="123 Wythe Ave, Apt 4, Brooklyn, NY 11249" />
            </label>
          )}
        </section>

        {/* 3. Dates */}
        <section aria-labelledby="dates-h" className="grid gap-3">
          <h3 id="dates-h" className="flex items-baseline gap-2 text-[20px] font-bold"><i className="paint-dab" style={{ ["--dab" as string]: "var(--af-coral)" }} />Days that work</h3>
          <p className="-mt-1 text-[13.5px] text-ink-2">Up to three. We confirm one of them, or suggest another.</p>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {dates.map((d, i) => (
              <label key={i} className="af-field">
                <span className="label">{i === 0 ? "First choice" : i === 1 ? "Second choice (optional)" : "Third choice (optional)"}</span>
                <input id={`scan-date-${i}`} type="date" min={minDay} value={d} onChange={(e) => setDates((x) => x.map((y, j) => (j === i ? e.target.value : y)))} />
              </label>
            ))}
          </div>
          <label className="af-field">
            <span className="label">Notes <span className="text-ink-2">(optional)</span></span>
            <textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Framed under glass, still drying, very valuable, best time to reach you…" />
          </label>
        </section>
      </div>

      {/* Live estimate */}
      <aside aria-label="Estimate" className="grid gap-4 lg:sticky lg:top-6">
        <section className="af-card grid gap-3 p-4 sm:p-5" aria-live="polite">
          <h3 className="text-[20px] font-bold">Estimate</h3>
          <dl className="num grid gap-1.5 text-[14.5px]">
            {[...settings.bands.map((b) => b.key), "oversized" as const].map((k) => {
              const n = items.filter((i) => i.band === k).length;
              if (!n) return null;
              const price = k === "oversized" ? null : settings.bands.find((b) => b.key === k)?.priceCents ?? null;
              return (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-ink-2">{n} × {bandLabel(k, settings.bands)}</dt>
                  <dd>{price != null ? usd(price * n) : "Quote"}</dd>
                </div>
              );
            })}
            {unsized.length > 0 && <div className="flex justify-between gap-3"><dt className="text-ink-2">{unsized.length} without a size yet</dt><dd className="text-coral">Pick a size</dd></div>}
            {handoff === "pickup" && <div className="flex justify-between gap-3"><dt className="text-ink-2">NYC pickup</dt><dd>{settings.pickupFeeCents != null ? usd(settings.pickupFeeCents) : "Quote"}</dd></div>}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <dt className="font-bold">{est.complete ? "Total" : "So far"}</dt>
              <dd className="text-right font-display text-[26px] font-extrabold leading-tight [font-variation-settings:'wdth'_80]">{pieces ? estimateText(est) : "—"}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-ink-2">Nothing is charged now. We confirm the date and final price first, then you pay from here.</p>
          {error && <Problem tone="error" title={error.message} fix={error.fix} />}
          <button type="submit" disabled={busy} className="btn btn-blue btn-lg relative z-0 w-full">
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            Request booking{pieces ? ` · ${pieces} ${pieces === 1 ? "painting" : "paintings"}` : ""}
          </button>
        </section>
        <section className="grid gap-1.5 rounded-2xl bg-wall p-4 text-[13.5px] text-ink-2">
          <b className="text-[14.5px] text-ink">While we have them</b>
          <p>{settings.care}</p>
          <p>Files on your artworks within {settings.turnaroundDays} days of drop-off.</p>
        </section>
      </aside>
    </form>
  );
}

function BandPicker({ id, name, label, value, onChange, settings }: { id: string; name: string; label: string; value: ItemBand | null; onChange: (b: ItemBand) => void; settings: Settings }) {
  return (
    <fieldset id={id} className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      <legend className="sr-only">{label}</legend>
      {ITEM_BANDS.map((k) => {
        const b = settings.bands.find((x) => x.key === k);
        const price = b?.priceCents;
        return (
          <label key={k} className={cn("grid cursor-pointer justify-items-center rounded-xl border-2 bg-white px-1 py-1.5 text-center leading-tight has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", value === k ? "border-ink" : "border-line hover:border-ink-2")}>
            <input type="radio" className="sr-only" name={name} checked={value === k} onChange={() => onChange(k)} />
            <span className="text-[14px] font-bold">{bandLabel(k, settings.bands)}</span>
            <span className="num text-[11.5px] text-ink-2">{b ? bandRange(b) : oversizedRange(settings.bands)}</span>
            <span className="num text-[12px] font-semibold">{price != null ? usd(price) : "Quote"}</span>
          </label>
        );
      })}
    </fieldset>
  );
}

// ---------- Booking history ----------

function BookingCard({ b, settings, highlight, onBookAgain }: { b: ScanBookingView; settings: Settings; highlight: boolean; onBookAgain?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [asking, setAsking] = useState(false);
  const step = STATUS_STEPS.indexOf(b.status);
  const date = b.scheduledFor ? dayLabel(b.scheduledFor.slice(0, 10)) : null;
  const best = largest(b.items.filter((i) => i.delivered).flatMap((i) => i.printableSizes));
  const n = b.items.length;

  async function pay() {
    setBusy("pay");
    try {
      const res = await fetch(`/api/studio/scanning/${b.id}/pay`, { method: "POST" });
      const data = await res.clone().json().catch(() => ({}));
      if (!res.ok || !data.url) {
        const p = await problemFrom(res, "Checkout didn't open. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : pay });
        setBusy(null);
        return;
      }
      if (data.dev) {
        saved("Paid (test mode)", { description: "No card was charged: Stripe isn't set up here." });
        router.push(data.url, { scroll: false });
        router.refresh();
        setBusy(null);
      } else {
        window.location.href = data.url;
      }
    } catch (err) {
      failed(errorText(err, "Checkout didn't open. Try again."), { retry: pay });
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    try {
      const res = await fetch(`/api/studio/scanning/${b.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
      if (!res.ok) {
        const p = await problemFrom(res, "Couldn't cancel. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : cancel });
        return;
      }
      saved("Booking cancelled", onBookAgain ? { next: { label: "Book again", href: "/studio/scanning" } } : undefined);
      setAsking(false);
      router.refresh();
    } catch (err) {
      failed(errorText(err), { retry: cancel });
    } finally {
      setBusy(null);
    }
  }

  const where = b.handoff === "pickup" ? <>We pick them up from <b className="text-ink">{b.pickupAddress}</b>.</> : b.dropoffInfo ? <>Drop-off: <span className="whitespace-pre-line font-semibold text-ink">{b.dropoffInfo}</span></> : null;

  // What happens next, and the button for it, on every state.
  const next: { title: string; body: React.ReactNode; actions?: React.ReactNode } = (() => {
    switch (b.status) {
      case "requested":
        return {
          title: "Next: we confirm your date and price",
          body: <>We&apos;re checking {b.preferredDates.map((d) => dayLabel(d)).join(", ") || "your dates"}. You&apos;ll get an email with the date and final price, usually within a business day. Estimate: {b.estimateCents != null ? usd(b.estimateCents) : "quote to follow"}.</>,
        };
      case "confirmed":
        return {
          title: `Confirmed for ${date} — pay ${usd(b.priceCents ?? 0)} to lock it in`,
          body: <>{where} Pay now and you&apos;re all set.</>,
          actions: (
            <button type="button" onClick={pay} disabled={!!busy} className="btn btn-blue">
              {busy === "pay" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Pay {usd(b.priceCents ?? 0)}
            </button>
          ),
        };
      case "paid":
        return b.receivedAt
          ? { title: "We have your paintings", body: <>Scanning starts shortly. Files will be on your artworks within {settings.turnaroundDays} days, and the paintings come back within {settings.returnDays} days.</> }
          : {
            title: b.handoff === "pickup" ? `Paid — we pick them up ${date}` : `Paid — drop them off ${date}`,
            body: <>{where} Take them out of their frames if you can, and wrap each one in paper or a sheet. We&apos;ll email you when they&apos;re with us.</>,
          };
      case "scanning":
        return { title: "Scanning now", body: <>Files go straight onto your artworks within {settings.turnaroundDays} days of drop-off. We&apos;ll email you the moment they&apos;re in.</> };
      case "delivered":
        return {
          title: best ? `Your scans are in — you can now sell up to ${sizeInches(best)}` : "Your scans are in",
          body: <>The new files are on your artworks and buyers see the new sizes now. Your paintings come back within {settings.returnDays} days of drop-off.</>,
          actions: <><Link href="/studio/art" className="btn btn-blue">See my art</Link>{b.items.find((i) => i.slug) && <Link href={`/studio/qr?art=${b.items.find((i) => i.slug)!.slug}`} className="btn btn-ghost">Print a code</Link>}</>,
        };
      case "returned":
        return { title: "All done — your paintings are back", body: <>Every scanned piece now prints sharp at its new sizes.</>, actions: onBookAgain && <button type="button" onClick={onBookAgain} className="btn btn-ghost">Book another scan</button> };
      case "cancelled":
        return { title: "Cancelled", body: <>{b.cancelReason || "This booking was cancelled."}{b.paidAt ? " Your payment is refunded to the card you used." : ""}</>, actions: onBookAgain && <button type="button" onClick={onBookAgain} className="btn btn-ghost">Book again</button> };
    }
  })();
  const cancellable = b.status === "requested" || b.status === "confirmed";

  return (
    <li id={`booking-${b.id}`} className={cn("af-card grid scroll-mt-24 gap-4 p-4 sm:p-5", highlight && "ring-2 ring-scan")}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13px] text-ink-2">Booked {dayLabel(new Date(b.createdAt))} · {n} {n === 1 ? "painting" : "paintings"} · {HANDOFF_LABEL[b.handoff]}{b.priceCents != null ? ` · ${usd(b.priceCents)}` : ""}</p>
          <h3 className="relative mt-0.5 text-[19px] font-bold">{next.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-white px-2.5 py-0.5 text-[12.5px] font-bold">
          <i className="paint-dab !h-2.5 !w-2.5" style={{ ["--dab" as string]: STATUS_DAB[b.status] }} aria-hidden="true" />{STATUS_LABEL[b.status]}{b.test && b.paidAt ? " · test" : ""}
        </span>
      </div>

      {b.status !== "cancelled" && (
        <ol className="grid grid-cols-6 gap-1" aria-label="Progress">
          {STATUS_STEPS.map((s, i) => (
            <li key={s} className="grid gap-1">
              <span className="relative h-2 overflow-hidden rounded-full bg-wall">{i <= step && <BrushStroke className="absolute inset-0 h-full w-full" color={i === step ? "var(--af-scan)" : "var(--af-earned)"} />}</span>
              <span className={cn("hidden truncate text-[11.5px] sm:block", i === step ? "font-bold text-ink" : "text-ink-2")}>{STATUS_LABEL[s].split(" ·")[0]}</span>
              <span className="sr-only">{STATUS_LABEL[s]}{i < step ? " (done)" : i === step ? " (now)" : ""}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-[14.5px] text-ink-2">{next.body}</p>

      <ul className="flex flex-wrap gap-2" aria-label="Paintings in this booking">
        {b.items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 rounded-xl border border-line bg-white py-1.5 pl-1.5 pr-3 text-[13px]">
            {i.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={i.imageUrl} alt="" className="h-9 w-9 rounded-[2px] object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-[2px] bg-wall"><ImageOff className="h-4 w-4 text-ink-2" aria-hidden="true" /></span>
            )}
            <span className="grid leading-tight">
              {i.slug ? <Link href={`/studio/art/${i.slug}`} className="font-semibold text-ink">{i.title}</Link> : <b>{i.title || "Not uploaded yet"}</b>}
              <span className="text-[12px] text-ink-2">
                {bandLabel((ITEM_BANDS as string[]).includes(i.band) ? (i.band as ItemBand) : "oversized", settings.bands)}
                {i.delivered ? ` · scanned, prints up to ${SIZE_LABEL[largest(i.printableSizes) ?? "small"]}` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {(next.actions || cancellable) && (
        <div className="flex flex-wrap items-center gap-2">
          {next.actions}
          {cancellable && !asking && <button type="button" onClick={() => setAsking(true)} className="btn btn-ghost btn-sm">Cancel booking</button>}
          {cancellable && asking && (
            <span className="flex flex-wrap items-center gap-2 rounded-xl bg-wall px-3 py-1.5 text-[14px]" role="group" aria-label="Confirm cancel">
              Cancel this booking?
              <button type="button" onClick={cancel} disabled={!!busy} className="btn btn-sm border-coral bg-coral text-white">{busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Yes, cancel</button>
              <button type="button" onClick={() => setAsking(false)} className="btn btn-ghost btn-sm">Keep it</button>
            </span>
          )}
        </div>
      )}
    </li>
  );
}
