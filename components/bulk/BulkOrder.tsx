"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorText, failed } from "@/lib/feedback";
import { Problem } from "@/components/studio/Problem";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import EditionBadge from "@/components/art/EditionBadge";
import QtyInput from "@/components/bulk/QtyInput";
import type { Edition } from "@/lib/editionFormat";
import {
  BULK_HANDLING_FEE_CENTS, BULK_MAX_LINES, BULK_MAX_PER_LINE, BULK_SIZES, BULK_SIZE_LABEL, BULK_TIERS,
  bulkQuote, bulkUnitCost, nextBulkTier,
} from "@/lib/bulk";
import type { PrintSize } from "@/lib/revenue";
import { cn } from "@/lib/utils";

/** sizes: the print sizes this file is sharp enough for. */
export type BulkArt = { id: string; slug: string; title: string; imageUrl: string; sensitive: string[]; edition: Edition | null; sizes: PrintSize[] };
export type PastBulk = {
  id: string; date: string; total: number; paid: boolean; status: string; address: string | null; test: boolean;
  items: { id: string; title: string; imageUrl: string | null; size: string | null; framed: boolean; quantity: number; edition: string }[];
};
type Line = { key: string; artworkId: string; size: PrintSize; framed: boolean; frameColor: "black" | "white" | "natural"; quantity: number };

const usd = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd0 = (c: number) => "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const FRAMES = [
  { key: "black", hex: "#15161b", label: "Black" },
  { key: "white", hex: "#ffffff", label: "White" },
  { key: "natural", hex: "#c8a477", label: "Oak" },
] as const;
const DRAFT = "af:bulk:draft";

export default function BulkOrder({ arts, past, placedId, defaultName }: { arts: BulkArt[]; past: PastBulk[]; placedId: string | null; defaultName: string }) {
  const router = useRouter();
  const byId = useMemo(() => new Map(arts.map((a) => [a.id, a])), [arts]);
  const [lines, setLines] = useState<Line[]>([]);
  const [sellAt, setSellAt] = useState("40");
  const [tags, setTags] = useState(true);
  const [ship, setShip] = useState({ name: defaultName, line1: "", line2: "", city: "", state: "", zip: "" });
  const [busy, setBusy] = useState(false);
  const [error, setErrorState] = useState<{ message: string; fix?: { label: string; href?: string; onClick?: () => void } } | null>(null);
  const setError = (message: string | null, fix?: { label: string; href?: string; onClick?: () => void }) => setErrorState(message ? { message, fix } : null);
  const toShipTo = () => { const el = document.getElementById("ship-to"); el?.scrollIntoView({ behavior: "smooth", block: "center" }); el?.querySelector("input")?.focus(); };

  // Keep a draft of the ship-to address on this device (not the order itself).
  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(DRAFT) || "null"); if (s?.line1) setShip((o) => ({ ...o, ...s })); } catch {}
  }, []);

  const quote = bulkQuote(lines);
  const next = nextBulkTier(quote.prints);
  const sellCents = Math.round((parseFloat(sellAt) || 0) * 100);
  const keep = sellCents - quote.perPrint;
  const placed = placedId ? past.find((p) => p.id === placedId) : null;

  const left = (artworkId: string, exceptKey?: string) => {
    const e = byId.get(artworkId)?.edition;
    if (!e) return BULK_MAX_PER_LINE;
    const used = lines.filter((l) => l.artworkId === artworkId && l.key !== exceptKey).reduce((n, l) => n + l.quantity, 0);
    return Math.max(0, Math.min(BULK_MAX_PER_LINE, e.left - used));
  };

  const add = (a: BulkArt) => {
    if (lines.length >= BULK_MAX_LINES) { failed(`Up to ${BULK_MAX_LINES} lines per order.`, { description: "Raise the count on a line you already have, or place a second order." }); return; }
    const room = left(a.id);
    if (room <= 0) { failed(a.edition?.soldOut ? `${a.title} is sold out.` : `No ${a.title} prints left.`, { description: "Its limited edition is used up. Pick another piece.", fix: { label: "About editions", href: "/help/selling/limited-editions" } }); return; }
    const size = (["M", "S", "L", "XL"] as PrintSize[]).find((s) => a.sizes.includes(s)) ?? "S";
    setLines((ls) => [...ls, { key: `${a.id}-${Date.now()}`, artworkId: a.id, size, framed: false, frameColor: "black", quantity: Math.min(10, room) }]);
  };
  const patch = (key: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...p } : l)));
  const remove = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  async function placeOrder() {
    setError(null);
    if (!lines.length) { setError("Pick at least one piece.", { label: "Pick work", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) }); return; }
    if (!ship.name.trim() || !ship.line1.trim() || !ship.city.trim() || !ship.state.trim() || !/^\d{5}(-\d{4})?$/.test(ship.zip.trim())) {
      setError("Add where to ship them: name, street, city, state and a 5-digit ZIP.", { label: "Fill in address", onClick: toShipTo });
      toShipTo();
      return;
    }
    try { localStorage.setItem(DRAFT, JSON.stringify(ship)); } catch {}
    setBusy(true);
    try {
      const res = await fetch("/api/studio/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lines: lines.map(({ key, ...l }) => l), ship, tags }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        const message = data.error || "Checkout didn't open. Try again.";
        // Fixable here: a size too big for the file, a sold-out edition, the address. Everything else: try again.
        setError(message, data.code === "address_required" ? { label: "Fill in address", onClick: toShipTo } : data.code === "size_too_big" || data.code === "sold_out" ? { label: "Change prints", onClick: () => window.scrollTo({ top: 0, behavior: "smooth" }) } : { label: "Try again", onClick: placeOrder });
        setBusy(false);
        return;
      }
      if (data.dev) {
        setLines([]);
        router.push(data.url, { scroll: true });
        router.refresh();
        setBusy(false);
      } else {
        window.location.href = data.url;
      }
    } catch (e) {
      const msg = errorText(e, "Checkout didn't open. Try again.");
      setError(msg, { label: "Try again", onClick: placeOrder });
      failed(msg, { retry: placeOrder });
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-8">
      {placed && (
        <section aria-live="polite" className="relative grid gap-3 overflow-hidden rounded-2xl border-[1.5px] border-ink bg-[#fffbe8] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <span className="sticker-badge">Order placed{placed.test ? " · test" : ""}</span>
            <h2 className="display relative mt-2 text-[34px]">
              {placed.items.reduce((n, i) => n + i.quantity, 0)} prints on the way
              <BrushStroke className="mt-0.5 h-2.5 w-44" />
            </h2>
            <p className="num mt-1 text-[14px] text-ink-2">{usd(placed.total)} · ships to {placed.address}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/studio/qr?preset=market&art=${arts.find((a) => a.title === placed.items[0]?.title)?.slug ?? arts[0].slug}`} className="btn btn-blue">Print hang tags</Link>
          </div>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
        <div className="grid min-w-0 gap-6">
          {/* 1. Pick work */}
          <section aria-labelledby="pick-h" className="grid gap-3">
            <h2 id="pick-h" className="flex items-baseline gap-2 text-[20px] font-bold">
              <i className="paint-dab" style={{ ["--dab" as string]: "var(--af-scan)" }} />Pick work
            </h2>
            <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 xl:grid-cols-6">
              {arts.map((a) => {
                const n = lines.filter((l) => l.artworkId === a.id).reduce((s, l) => s + l.quantity, 0);
                const out = !!a.edition?.soldOut;
                return (
                  <li key={a.id} className="w-[34vw] max-w-[150px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                    <button
                      type="button"
                      onClick={() => add(a)}
                      disabled={out}
                      className={cn(
                        "group relative grid w-full gap-1.5 rounded-xl p-1.5 text-left transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan disabled:opacity-50",
                        n ? "bg-scan-soft" : "hover:bg-wall",
                      )}
                      aria-label={`Add ${a.title}`}
                    >
                      <span className="relative grid aspect-square place-items-center overflow-hidden rounded-lg bg-gallery p-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.imageUrl} alt="" className="max-h-full max-w-full bg-white object-contain shadow-[0_6px_14px_-4px_rgba(21,22,27,.4)]" />
                        <span className={cn("absolute right-1.5 top-1.5 grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-[13px] font-bold", n ? "num bg-ink text-white" : "bg-white/90 text-ink opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100")}>
                          {n ? n : <Plus className="h-4 w-4" aria-hidden />}
                        </span>
                      </span>
                      <span className="truncate px-0.5 text-[13.5px] font-semibold">{a.title}</span>
                      <EditionBadge edition={a.edition} compact className="mx-0.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* 2. Lines */}
          <section aria-labelledby="lines-h" className="grid gap-3">
            <h2 id="lines-h" className="flex items-baseline gap-2 text-[20px] font-bold">
              <i className="paint-dab" style={{ ["--dab" as string]: "var(--af-sticker)" }} />Size, frame, how many
            </h2>
            {lines.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-line bg-wall px-4 py-8 text-center text-[15px] text-ink-2">Tap a piece above to add it.</p>
            ) : (
              <ul className="grid gap-3">
                {lines.map((l, i) => {
                  const a = byId.get(l.artworkId)!;
                  const max = left(l.artworkId, l.key);
                  const q = quote.lines[i];
                  return (
                    <li key={l.key} className="af-panel grid gap-3 p-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:p-4">
                      <div className="flex items-center gap-3 sm:row-span-2 sm:block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.imageUrl} alt={a.title} className="h-16 w-14 shrink-0 rounded-[2px] bg-white object-cover shadow-[0_4px_10px_-3px_rgba(21,22,27,.35)] sm:h-[88px] sm:w-[72px]" />
                        <div className="min-w-0 flex-1 sm:hidden">
                          <b className="block truncate">{a.title}</b>
                          {a.edition && <span className="num text-[12.5px] text-ink-2">{a.edition.left} of {a.edition.size} left</span>}
                        </div>
                        <button type="button" onClick={() => remove(l.key)} className="grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink sm:hidden" aria-label={`Remove ${a.title}`}>
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="hidden items-baseline justify-between gap-2 sm:flex">
                        <b className="truncate">{a.title}{a.edition && <span className="num ml-2 text-[12.5px] font-normal text-ink-2">{a.edition.left} of {a.edition.size} left</span>}</b>
                        <button type="button" onClick={() => remove(l.key)} className="flex items-center gap-1 text-[13px] font-semibold text-ink-2 hover:text-ink" aria-label={`Remove ${a.title}`}>
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />Remove
                        </button>
                      </div>
                      <div className="grid gap-3">
                        <fieldset className="grid grid-cols-4 gap-1.5">
                          <legend className="sr-only">Size for {a.title}</legend>
                          {BULK_SIZES.map((s) => {
                            const ok = a.sizes.includes(s);
                            return (
                              <label key={s} title={ok ? undefined : "This file would print soft at this size"} className={cn("grid justify-items-center rounded-xl border-2 px-1 py-1.5 text-center leading-tight has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", !ok ? "cursor-not-allowed border-dashed border-line bg-wall opacity-50" : l.size === s ? "cursor-pointer border-ink bg-white" : "cursor-pointer border-line bg-white hover:border-ink-2")}>
                                <input type="radio" className="sr-only" name={`size-${l.key}`} checked={l.size === s} disabled={!ok} onChange={() => patch(l.key, { size: s })} />
                                <span className="text-[14px] font-bold">{BULK_SIZE_LABEL[s].name}</span>
                                <span className="num text-[11.5px] text-ink-2">{BULK_SIZE_LABEL[s].inches}</span>
                                <span className="num text-[12px] font-semibold">{usd0(bulkUnitCost(s, l.framed))}</span>
                              </label>
                            );
                          })}
                        </fieldset>
                        {a.sizes.length < BULK_SIZES.length && (
                          <p className="-mt-1.5 text-[12.5px] text-ink-2">Greyed sizes would print soft from this file.</p>
                        )}
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold">
                              <input type="checkbox" checked={l.framed} onChange={(e) => patch(l.key, { framed: e.target.checked })} className="h-5 w-5 accent-[#2b37f0]" />
                              Framed
                            </label>
                            {l.framed && (
                              <span className="flex gap-1" role="radiogroup" aria-label="Frame color">
                                {FRAMES.map((f) => (
                                  <button key={f.key} type="button" role="radio" aria-checked={l.frameColor === f.key} aria-label={f.label} onClick={() => patch(l.key, { frameColor: f.key })}
                                    className={cn("h-7 w-7 rounded-full border-2 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-scan", l.frameColor === f.key ? "border-ink ring-2 ring-sticker" : "border-ink/25")}
                                    style={{ background: f.hex }} />
                                ))}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <QtyInput value={l.quantity} max={Math.max(1, max)} onChange={(n) => patch(l.key, { quantity: n })} label={`How many ${a.title}`} />
                            <span className="num min-w-[76px] text-right text-[15px] font-bold">{usd(q.lineTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 3. Ship to */}
          <section id="ship-to" aria-labelledby="ship-h" className="grid gap-3">
            <h2 id="ship-h" className="flex items-baseline gap-2 text-[20px] font-bold">
              <i className="paint-dab" style={{ ["--dab" as string]: "var(--af-coral)" }} />Ship to you
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-6">
              <label className="af-field sm:col-span-6"><span className="label">Name</span><input autoComplete="name" value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} /></label>
              <label className="af-field sm:col-span-4"><span className="label">Street</span><input autoComplete="address-line1" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} /></label>
              <label className="af-field sm:col-span-2"><span className="label">Apt <span className="text-ink-2">(optional)</span></span><input autoComplete="address-line2" value={ship.line2} onChange={(e) => setShip({ ...ship, line2: e.target.value })} /></label>
              <label className="af-field sm:col-span-3"><span className="label">City</span><input autoComplete="address-level2" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} /></label>
              <div className="grid grid-cols-2 gap-2.5 sm:col-span-3">
                <label className="af-field"><span className="label">State</span><input autoComplete="address-level1" maxLength={30} value={ship.state} onChange={(e) => setShip({ ...ship, state: e.target.value })} /></label>
                <label className="af-field"><span className="label">ZIP</span><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={ship.zip} onChange={(e) => setShip({ ...ship, zip: e.target.value })} /></label>
              </div>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside aria-label="Order summary" className="grid gap-4 lg:sticky lg:top-6">
          <section className="af-card grid gap-3 p-4 sm:p-5">
            <h2 className="text-[20px] font-bold">At cost</h2>
            <dl className="num grid gap-1.5 text-[14.5px]">
              <div className="flex justify-between gap-3"><dt className="text-ink-2">{quote.prints} {quote.prints === 1 ? "print" : "prints"}</dt><dd>{usd(quote.subtotal)}</dd></div>
              {quote.discount > 0 && (
                <div className="flex justify-between gap-3"><dt><span className="rounded-full bg-sticker px-2 py-0.5 text-[12.5px] font-bold">{quote.discountPct}% off</span> <span className="text-ink-2">volume</span></dt><dd>−{usd(quote.discount)}</dd></div>
              )}
              <div className="flex justify-between gap-3"><dt className="text-ink-2">Handling, shipping included</dt><dd>{usd(quote.handling || (lines.length ? BULK_HANDLING_FEE_CENTS : 0))}</dd></div>
              <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
                <dt className="font-bold">Total</dt>
                <dd className="font-display text-[30px] font-extrabold leading-none [font-variation-settings:'wdth'_80]">{usd(quote.total)}</dd>
              </div>
              {quote.prints > 0 && <div className="flex justify-between gap-3 text-[13px] text-ink-2"><dt>Each, all in</dt><dd>{usd(quote.perPrint)}</dd></div>}
            </dl>

            {/* Volume tiers */}
            <div className="grid gap-1.5" aria-label="Volume discounts">
              <div className="flex gap-1.5">
                {[...BULK_TIERS].sort((a, b) => a.min - b.min).map((t) => {
                  const on = quote.prints >= t.min;
                  return (
                    <span key={t.min} className={cn("num flex items-center gap-1 rounded-full border-[1.5px] px-2.5 py-1 text-[12.5px] font-bold", on ? "border-ink bg-sticker" : "border-line text-ink-2")}>
                      {on && <Check className="h-3.5 w-3.5" aria-hidden />}{t.min}+ · {t.pct}% off
                    </span>
                  );
                })}
              </div>
              {next && quote.prints > 0 && <p className="text-[13px] text-ink-2">Add {next.more} more for {next.pct}% off.</p>}
            </div>
          </section>

          {/* Margin calculator */}
          <section aria-labelledby="margin-h" className="grid gap-2.5 rounded-2xl bg-wall p-4 sm:p-5">
            <h2 id="margin-h" className="text-[16px] font-bold">At your market</h2>
            <label className="flex flex-wrap items-center gap-2 text-[15px]">
              Sell at
              <span className="flex items-center rounded-lg border-2 border-ink bg-white px-2 py-1 focus-within:border-scan">
                <span className="text-ink-2">$</span>
                <input inputMode="decimal" value={sellAt} onChange={(e) => setSellAt(e.target.value.replace(/[^0-9.]/g, "").slice(0, 6))} aria-label="Your price per print, in dollars" className="num w-16 bg-transparent text-[16px] font-semibold outline-none" />
              </span>
              each
            </label>
            {quote.prints > 0 ? (
              <p className="text-[15px] leading-snug">
                You keep <b className={cn("num font-display text-[26px] font-extrabold [font-variation-settings:'wdth'_80]", keep > 0 ? "text-earned" : "text-coral")}>{keep >= 0 ? usd(keep) : `−${usd(-keep)}`}</b> per print
                {keep > 0 && <span className="num block text-[13px] text-ink-2">{usd(keep * quote.prints)} if all {quote.prints} sell</span>}
              </p>
            ) : (
              <p className="text-[14px] text-ink-2">Add prints to see what you keep.</p>
            )}
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-white p-4">
            <input type="checkbox" checked={tags} onChange={(e) => setTags(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#2b37f0]" />
            <span className="grid gap-0.5">
              <b className="text-[15px]">Include matching QR hang tags</b>
              <span className="text-[13px] text-ink-2">
                Print them yourself, free. <Link href={`/studio/qr?preset=market&art=${byId.get(lines[0]?.artworkId ?? "")?.slug ?? arts[0].slug}`} className="font-semibold text-scan underline-offset-2 hover:underline">Market tags</Link>
              </span>
            </span>
          </label>

          {error && <Problem tone="error" title={error.message} fix={error.fix} />}
          <button type="button" onClick={placeOrder} disabled={busy || !lines.length} className="btn btn-blue btn-lg w-full">
            {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
            {lines.length ? `Pay ${usd(quote.total)}` : "Pick a piece"}
          </button>
          <p className="text-center text-[12.5px] text-ink-2">Bulk prints don&apos;t count as sales or earnings.</p>
        </aside>
      </div>

      {/* Phones: the total and Pay stay in reach */}
      {lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white/95 px-4 pt-3 backdrop-blur pb-[calc(12px+env(safe-area-inset-bottom))] lg:hidden">
          <span className="min-w-0 flex-1 leading-tight">
            <b className="num block font-display text-[24px] font-extrabold [font-variation-settings:'wdth'_80]">{usd(quote.total)}</b>
            <span className="num text-[12.5px] text-ink-2">{quote.prints} prints{quote.discountPct ? ` · ${quote.discountPct}% off` : ""}</span>
          </span>
          <button type="button" onClick={placeOrder} disabled={busy} className="btn btn-blue shrink-0 px-6">
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Pay
          </button>
          <style>{`@media (max-width: 1023px) { body { padding-bottom: calc(84px + env(safe-area-inset-bottom)); } }`}</style>
        </div>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-h" className="grid gap-3 border-t border-line pt-6">
          <h2 id="past-h" className="text-[20px] font-bold">Your bulk orders</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {past.map((o) => (
              <li key={o.id} className={cn("af-panel grid gap-2 p-4", o.id === placedId && "border-ink")}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b className="num">{new Date(o.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</b>
                  <span className="flex items-center gap-2 text-[13px]">
                    {o.test && <span className="rounded-full bg-wall px-2 py-0.5 font-semibold text-ink-2">Test</span>}
                    <span className="rounded-full bg-scan-soft px-2 py-0.5 font-semibold capitalize text-scan">{o.paid ? o.status : "unpaid"}</span>
                    <b className="num">{usd(o.total)}</b>
                  </span>
                </div>
                <ul className="grid gap-1.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2.5 text-[14px]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {i.imageUrl && <img src={i.imageUrl} alt="" className="h-9 w-8 shrink-0 rounded-[2px] object-cover" />}
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate font-semibold">{i.title}</span>
                        <span className="num text-[12.5px] text-ink-2">
                          {BULK_SIZE_LABEL[(i.size as PrintSize) ?? "M"]?.name ?? i.size}{i.framed ? " · framed" : ""} · ×{i.quantity}{i.edition ? ` · ${i.edition}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
