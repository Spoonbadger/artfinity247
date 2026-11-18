"use client";
// Print codes (/studio/print, and /admin/artists/[id]/print for admins): one screen for every print.
// Tick pieces, give each its own size and copies (1 colour label by default), pick the paper, and see the real sheets:
// every card packed onto as few sheets as fit (lib/printPack.ts, the same layout the PDF uses). Download PDF prints
// it and counts as printed. Mail them to me sends exactly these cards to Stripe. Nothing waits in a list.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Minus, Plus, Search, Sparkles, Truck, X } from "lucide-react";
import { EmptyState } from "@/components/studio/EmptyState";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { fillExtra, pack, PAPER_MARGIN, type PackItem, type Placed } from "@/lib/printPack";
import {
  MAX_COPIES, PAPER_MAX, PAPER_MIN, PAPER_ORDER, PLAIN_PAPERS, SIZE_NAME, SIZE_ORDER, cardBox, isLabelSheet, paperName, paperSize, sizeLabel,
  type CustomPaper, type PaperKey, type SizeKey,
} from "@/lib/printOptions";
import { TEMPLATES, type CustomSize, type TemplateKey } from "@/components/qr/card";
import { quoteFor, type CodePrintPricing, type ShipAddress } from "@/lib/printQueueFormat";
import type { PrintablePieces } from "@/lib/printJob";
import MailOrder from "./MailOrder";

type Piece = PrintablePieces["pieces"][number];
type Row = { on: boolean; code: string | null; size: SizeKey; copies: number };
export type Preset = Partial<Pick<Row, "code" | "size" | "copies">>;

const PAPER_KEY = "af-print-paper";
const MAX_PREVIEW = 8;
/** Preview colours per size, so a mixed sheet reads at a glance. */
const TONE: Record<string, { fill: string; edge: string }> = {
  label: { fill: "#f6e1e6", edge: "#8b2a4b" },
  sticker: { fill: "#fff3c4", edge: "#b08900" },
  tag: { fill: "#e3f1ea", edge: "#0f7a55" },
  poster: { fill: "#e7ecfb", edge: "#3b4fc4" },
  custom: { fill: "#f3e8f7", edge: "#7b2d8e" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function PrintCodes({ pieces, preset, pro, forArtist, mail, note }: {
  pieces: Piece[];
  /** Pieces to start ticked (from the button that opened this screen), by piece id. */
  preset: Record<string, Preset>;
  /** Infinity: custom sizes can be picked. */
  pro: boolean;
  /** An admin printing for this artist. */
  forArtist?: { id: string; name: string } | null;
  /** Mail orders (the artist's own screen only). */
  mail?: { pricing: CodePrintPricing; infinity: boolean; address: ShipAddress; testMode: boolean } | null;
  /** One line on top, e.g. codes carried over from the old print queue. */
  note?: string | null;
}) {
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(pieces.map((p) => {
      const s = preset[p.id];
      return [p.id, { on: !!s, code: s?.code ?? p.defaultCode, size: s?.size ?? p.size, copies: Math.max(1, s?.copies ?? 1) }];
    })),
  );
  // Ticked pieces first, in the order they came; fixed on load so rows don't jump while you tick.
  const [order] = useState(() => [...pieces.filter((p) => preset[p.id]), ...pieces.filter((p) => !preset[p.id])].map((p) => p.id));
  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  // A refresh can drop a piece while this screen is open (rejected, removed), so skip any that are gone.
  const live = useMemo(() => order.flatMap((id) => byId.get(id) ?? []), [order, byId]);
  const [q, setQ] = useState("");
  const [paper, setPaper] = useState<PaperKey>("letter");
  const [customPaper, setCustomPaper] = useState<CustomPaper>({ w: 8.5, h: 11 });
  const [busy, setBusy] = useState(false);
  const [showMail, setShowMail] = useState(false);
  const [priceTick, setPriceTick] = useState(0);

  // Remember the paper between visits (a convenience; the screen works without it).
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(PAPER_KEY) || "null");
      if (v && PAPER_ORDER.includes(v.paper)) { setPaper(v.paper); if (v.custom) setCustomPaper(v.custom); }
    } catch { /* private window */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(PAPER_KEY, JSON.stringify({ paper, custom: customPaper })); } catch { /* ignore */ }
  }, [paper, customPaper]);

  const set = (id: string, patch: Partial<Row>) => setRows((o) => ({ ...o, [id]: { ...o[id], ...patch } }));
  const customOf = (p: Piece, r: Row): CustomSize | null => p.codes.find((c) => c.code === r.code)?.custom ?? null;
  const sizesFor = (p: Piece, r: Row): SizeKey[] => [...SIZE_ORDER, ...(pro && customOf(p, r) ? (["custom"] as const) : [])];

  const ticked = live.map((p) => ({ p, r: rows[p.id] })).filter(({ r }) => r.on && r.copies > 0);
  const paperBox = paperSize(paper, customPaper);
  const items = useMemo(() => {
    const out: PackItem<string>[] = [];
    for (const { p, r } of ticked) {
      const box = cardBox(r.size, customOf(p, r));
      if (box) for (let i = 0; i < r.copies; i++) out.push({ ...box, ref: p.id });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, live]);
  const laid = useMemo(() => pack(items, paperBox), [items, paperBox.w, paperBox.h, paper]); // eslint-disable-line react-hooks/exhaustive-deps
  const cards = items.length - laid.unplaced.length;
  const sheets = laid.sheets.length;

  // How full the last sheet is (plain paper, small cards only), to offer "fill the empty space".
  const room = useMemo(() => {
    const last = laid.sheets[laid.sheets.length - 1];
    if (!last || paperBox.slots || last.cards.some((c) => c.scale !== 1)) return 0;
    const usable = (paperBox.w - 2 * PAPER_MARGIN) * (paperBox.h - 2 * PAPER_MARGIN);
    return 1 - last.cards.reduce((n, c) => n + c.w * c.h, 0) / usable;
  }, [laid, paperBox]);

  function fillEmpty() {
    const lines = ticked.map(({ p, r }) => ({ ...(cardBox(r.size, customOf(p, r)) ?? { w: 99, h: 99 }), copies: r.copies }));
    const extra = fillExtra(lines, paperBox);
    const added = extra.reduce((a, b) => a + b, 0);
    if (!added) { saved("No room for another card", { description: "The sheets are as full as they get." }); return; }
    setRows((o) => {
      const n = { ...o };
      ticked.forEach(({ p }, i) => { if (extra[i]) n[p.id] = { ...n[p.id], copies: Math.min(MAX_COPIES, n[p.id].copies + extra[i]) }; });
      return n;
    });
    saved(`Added ${plural(added, "card")}`, { description: "Extra copies fill the empty space. Same number of sheets." });
  }

  const shown = live.filter((p) => !q.trim() || p.title.toLowerCase().includes(q.trim().toLowerCase()));
  const allOn = shown.length > 0 && shown.every((p) => rows[p.id].on);
  const setAll = (patch: (p: Piece, r: Row) => Partial<Row> | null) =>
    setRows((o) => {
      const n = { ...o };
      for (const { p } of ticked) { const ch = patch(p, n[p.id]); if (ch) n[p.id] = { ...n[p.id], ...ch }; }
      return n;
    });
  const commonCopies = ticked.length && ticked.every(({ r }) => r.copies === ticked[0].r.copies) ? ticked[0].r.copies : null;
  const commonSize = ticked.length && ticked.every(({ r }) => r.size === ticked[0].r.size) ? ticked[0].r.size : "";

  const lines = ticked.map(({ p, r }) => ({ artworkId: p.id, code: r.code, size: r.size, copies: r.copies }));
  const hasCustom = ticked.some(({ r }) => r.size === "custom");
  const quote = useMemo(() => {
    if (!mail) return null;
    const c: Record<string, number> = {};
    for (const { r } of ticked) if (r.size !== "custom") c[r.size] = (c[r.size] || 0) + r.copies;
    return quoteFor(c, mail.pricing, { infinity: mail.infinity });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, mail, priceTick]);

  async function download() {
    if (busy || !cards) return;
    setBusy(true);
    try {
      const r = await fetch("/api/studio/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, paper, customPaper: paper === "custom" ? customPaper : undefined, artistId: forArtist?.id }),
      });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't make the PDF. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : download });
        return;
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || "artfinity-codes.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      const n = Number(r.headers.get("X-Af-Cards")) || cards, s = Number(r.headers.get("X-Af-Sheets")) || sheets;
      saved(`${plural(n, "card")} on ${plural(s, "sheet")}`, { description: `Print at 100% (actual size)${paperBox.slots ? "" : ", then cut on the grey lines"}.` });
    } catch (e) {
      failed(errorText(e, "Couldn't make the PDF. Try again."), { retry: download });
    } finally {
      setBusy(false);
    }
  }

  if (!pieces.length) {
    return (
      <EmptyState
        title="Nothing to print yet"
        body={forArtist ? `${forArtist.name} has no live pieces yet.` : "Upload a piece and its code is ready to print."}
        action={forArtist ? undefined : { label: "Upload art", href: "/studio/upload" }}
      />
    );
  }

  const summary = !cards ? "Tick a piece to print" : `${plural(sheets, "sheet")}, ${plural(cards, "card")}`;
  const unplacedNote = laid.unplaced.length
    ? isLabelSheet(paper)
      ? `${plural(laid.unplaced.length, "card doesn't", "cards don't")} match these labels. Change their size or pick plain paper.`
      : `${plural(laid.unplaced.length, "card is", "cards are")} bigger than this paper.`
    : null;

  return (
    <div className="grid gap-5">
      {forArtist && (
        <div className="box flex flex-wrap items-center gap-x-3 gap-y-1 border-sticker bg-sticker/15 px-4 py-3 text-[15px]" role="status">
          <b>Printing for {forArtist.name}</b>
          <span className="text-ink-2">Prints count as theirs in My codes and are noted in the admin log.</span>
        </div>
      )}
      {note && <p className="box-inset px-4 py-3 text-[15px]">{note}</p>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ---------- pieces ---------- */}
        <section aria-labelledby="pieces-h" className="box grid gap-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="pieces-h" className="t-card">Pieces <span className="font-normal text-ink-2">· {ticked.length} ticked</span></h2>
            <button type="button" className="text-[14px] font-semibold text-scan" onClick={() => setRows((o) => { const n = { ...o }; for (const p of shown) n[p.id] = { ...n[p.id], on: !allOn }; return n; })}>
              {allOn ? "Untick all" : q ? "Tick these" : "Tick all"}
            </button>
          </div>
          {pieces.length > 6 && (
            <label className="relative block">
              <span className="sr-only">Search your pieces</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your pieces" className="min-h-[42px] w-full rounded-full border-[1.5px] border-[color:var(--af-field-edge)] bg-white pl-9 pr-9 text-[15px]" />
              {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-wall"><X className="h-4 w-4" aria-hidden="true" /></button>}
            </label>
          )}

          {ticked.length > 1 && (
            <div className="box-inset flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 text-[14px]">
              <b className="text-[13.5px]">All ticked</b>
              <label className="inline-flex items-center gap-2">
                Size
                <select value={commonSize} onChange={(e) => { const v = e.target.value as SizeKey; if (v) setAll((p, r) => (sizesFor(p, r).includes(v) ? { size: v } : null)); }} className="min-h-[36px] rounded-lg border-[1.5px] border-[color:var(--af-field-edge)] bg-white px-2">
                  {!commonSize && <option value="">Mixed</option>}
                  {SIZE_ORDER.map((s) => <option key={s} value={s}>{SIZE_NAME[s]}</option>)}
                </select>
              </label>
              <span className="inline-flex items-center gap-2">
                Copies of each
                <Stepper value={commonCopies} label="Copies of each ticked piece" onChange={(v) => setAll(() => ({ copies: v }))} />
              </span>
            </div>
          )}

          {/* The rows follow this card's width, not the window's: the Studio sidebar can leave it narrow on a wide screen. */}
          <ul className="grid [container-type:inline-size]">
            {shown.map((p) => {
              const r = rows[p.id];
              const cz = customOf(p, r);
              return (
                <li key={p.id} className={cn("grid items-center gap-x-3 gap-y-1.5 border-t border-edge py-2.5 first:border-t-0 [@container(min-width:520px)]:grid-cols-[minmax(0,1fr)_auto_auto]", !r.on && "opacity-80")}>
                  <div className="flex min-w-0 items-center gap-3">
                    <label className="flex min-h-[44px] shrink-0 cursor-pointer items-center gap-3">
                      <input type="checkbox" checked={r.on} onChange={(e) => set(p.id, { on: e.target.checked })} className="h-5 w-5 shrink-0 accent-[var(--af-scan)]" aria-label={`Print ${p.title}`} />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md bg-wall object-cover" />
                    </label>
                    <div className="min-w-0">
                      <button type="button" onClick={() => set(p.id, { on: !r.on })} className="block max-w-full truncate text-left font-semibold text-ink">{p.title}</button>
                      <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-2">
                        {p.codes.length > 1 ? (
                          <label className="inline-flex items-center gap-1">
                            <span className="sr-only">Code for {p.title}</span>
                            <select value={r.code ?? ""} onChange={(e) => set(p.id, { code: e.target.value, size: r.size === "custom" ? p.size : r.size })} className="max-w-[200px] rounded border border-edge bg-white px-1 py-0.5 text-[13px]">
                              {p.codes.map((c) => <option key={c.code} value={c.code}>{c.code}{c.name ? ` · ${c.name}` : ""}{c.discountPct ? ` · ${c.discountPct}% off` : ""}</option>)}
                            </select>
                          </label>
                        ) : r.code ? <span className="num">Code {r.code}</span> : <span>New code on first print</span>}
                        {p.inReview && <span className="rounded-full bg-sticker/40 px-1.5 text-[12px] font-semibold text-ink">In review</span>}
                      </div>
                    </div>
                  </div>
                  {/* A narrow card: size and copies on a second line, under the title. Wider: their own columns. */}
                  <div className="flex items-center justify-between gap-3 pl-[88px] [@container(min-width:520px)]:contents">
                    <label className="min-w-0">
                      <span className="sr-only">Size for {p.title}</span>
                      <select value={r.size} onChange={(e) => set(p.id, { size: e.target.value as SizeKey, on: true })} className="min-h-[40px] max-w-full rounded-full border-[1.5px] border-[color:var(--af-field-edge)] bg-white px-3 text-[14px]">
                        {sizesFor(p, r).map((s) => <option key={s} value={s}>{sizeLabel(s, cz)}</option>)}
                      </select>
                    </label>
                    <Stepper value={r.copies} label={`Copies of ${p.title}`} onChange={(v) => set(p.id, { copies: v, on: true })} />
                  </div>
                </li>
              );
            })}
            {!shown.length && <li className="py-6 text-center text-ink-2">No piece matches “{q}”.</li>}
          </ul>
        </section>

        {/* ---------- paper, preview, actions ---------- */}
        <aside className="grid gap-4 lg:sticky lg:top-24" aria-label="Paper and preview">
          <div className="box grid gap-3 p-4">
            <label className="grid gap-1">
              <span className="text-[13px] font-semibold text-ink-2">Paper</span>
              <select value={paper} onChange={(e) => setPaper(e.target.value as PaperKey)} className="min-h-[42px] rounded-lg border-[1.5px] border-[color:var(--af-field-edge)] bg-white px-2.5 text-[15px]">
                <optgroup label="Plain paper">
                  {(Object.keys(PLAIN_PAPERS) as (keyof typeof PLAIN_PAPERS)[]).map((k) => <option key={k} value={k}>{PLAIN_PAPERS[k].name}, {PLAIN_PAPERS[k].sub}</option>)}
                  <option value="custom">Other size…</option>
                </optgroup>
                <optgroup label="Ready-cut label sheets (US Letter)">
                  {(Object.keys(TEMPLATES) as TemplateKey[]).map((k) => <option key={k} value={k}>{TEMPLATES[k].name}</option>)}
                </optgroup>
              </select>
            </label>
            {paper === "custom" && (
              <div className="flex items-end gap-2 text-[14px]">
                {(["w", "h"] as const).map((k) => (
                  <label key={k} className="grid gap-1">
                    <span className="text-[13px] text-ink-2">{k === "w" ? "Width" : "Height"}, in</span>
                    <input type="number" min={PAPER_MIN} max={PAPER_MAX} step={0.25} value={customPaper[k]} onChange={(e) => setCustomPaper((o) => ({ ...o, [k]: Math.max(PAPER_MIN, Math.min(PAPER_MAX, Number(e.target.value) || o[k])) }))} className="min-h-[40px] w-24 rounded-lg border-[1.5px] border-[color:var(--af-field-edge)] bg-white px-2" />
                  </label>
                ))}
              </div>
            )}

            <div className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-[15px]" aria-live="polite">{summary}</b>
                {sheets > MAX_PREVIEW && <span className="text-[13px] text-ink-2">Showing {MAX_PREVIEW}</span>}
              </div>
              {cards > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {laid.sheets.slice(0, MAX_PREVIEW).map((s, i) => (
                    <SheetPreview key={i} n={i + 1} paper={paperBox} cards={s.cards} titleOf={(id) => byId.get(id)?.title || ""} sizeOf={(id) => rows[id].size} cut={!paperBox.slots} />
                  ))}
                </div>
              ) : (
                <p className="box-inset px-3 py-6 text-center text-[14px] text-ink-2">The sheets show up here as you tick pieces.</p>
              )}
              {unplacedNote && <p className="text-[13.5px] font-semibold text-coral" role="alert">{unplacedNote}</p>}
              {room > 0.18 && cards > 0 && !unplacedNote && (
                <button type="button" onClick={fillEmpty} className="inline-flex items-center gap-1.5 justify-self-start text-[14px] font-semibold text-scan">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />Fill the empty space with extra copies
                </button>
              )}
              {cards > 0 && <p className="text-[13px] text-ink-2">{paperBox.slots ? `Print at 100% on ${paperName(paper)}.` : "Print at 100% (actual size). Cut on the grey lines."}</p>}
            </div>

            <div className="grid gap-2 border-t border-edge pt-3">
              <button type="button" onClick={download} disabled={!cards || busy || !!unplacedNote} className="btn btn-blue w-full">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
                {busy ? "Making your PDF…" : "Download PDF"}
              </button>
              {mail && (
                <button type="button" onClick={() => setShowMail((v) => !v)} disabled={!cards} aria-expanded={showMail} className="btn btn-ghost w-full">
                  <Truck className="h-4 w-4" aria-hidden="true" />
                  {showMail ? "Hide mail order" : quote && quote.cards ? `Mail them to me · ${(quote.total / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })}` : "Mail them to me"}
                </button>
              )}
            </div>
          </div>

          {mail && showMail && cards > 0 && (
            hasCustom ? (
              <p className="box px-4 py-3 text-[14px]">We mail standard sizes only. Switch custom sizes to a label, sticker, tag or poster, or print those at home.</p>
            ) : quote && (
              <MailOrder quote={quote} infinity={mail.infinity} pricing={mail.pricing} address={mail.address} testMode={mail.testMode} lines={lines} onPriceChange={() => { setPriceTick((t) => t + 1); location.reload(); }} />
            )
          )}
          {mail && <Link href="/studio/purchases" className="justify-self-start text-[14px] font-semibold text-scan">Past mail orders</Link>}
        </aside>
      </div>

      {/* Phones: the main action stays in reach while scrolling the list. */}
      {cards > 0 && (
        <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-3 border-t border-edge bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <span className="text-[14px] font-semibold">{summary}</span>
          <button type="button" onClick={download} disabled={busy || !!unplacedNote} className="btn btn-blue btn-sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}Download PDF
          </button>
        </div>
      )}
    </div>
  );
}

/** − n + with a typed number in the middle. value null = mixed (the "all ticked" control). */
function Stepper({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  const v = value ?? 1;
  return (
    <span className="inline-flex h-10 items-center rounded-full border-[1.5px] border-[color:var(--af-field-edge)] bg-white" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(1, v - 1))} disabled={value !== null && v <= 1} aria-label="One fewer" className="grid h-10 w-10 place-items-center rounded-full disabled:opacity-40"><Minus className="h-4 w-4" aria-hidden="true" /></button>
      <input
        type="number" inputMode="numeric" min={1} max={MAX_COPIES} value={value ?? ""} placeholder="–" aria-label={label}
        onChange={(e) => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n) && n >= 1) onChange(Math.min(MAX_COPIES, n)); }}
        className="num w-9 bg-transparent text-center text-[15px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" onClick={() => onChange(Math.min(MAX_COPIES, value === null ? 1 : v + 1))} aria-label="One more" className="grid h-10 w-10 place-items-center rounded-full"><Plus className="h-4 w-4" aria-hidden="true" /></button>
    </span>
  );
}

/** One sheet as it will print: every card in place, coloured by size, named by its piece. */
function SheetPreview({ n, paper, cards, titleOf, sizeOf, cut }: {
  n: number; paper: { w: number; h: number }; cards: Placed<string>[]; titleOf: (id: string) => string; sizeOf: (id: string) => SizeKey; cut: boolean;
}) {
  const S = 20; // svg units per inch
  return (
    <figure className="grid gap-1">
      <svg viewBox={`0 0 ${paper.w * S} ${paper.h * S}`} className="w-full rounded-sm border border-edge bg-white shadow-[0_1px_2px_rgba(0,0,0,.06)]" role="img" aria-label={`Sheet ${n}: ${cards.length} ${cards.length === 1 ? "card" : "cards"}`}>
        {cards.map((c, i) => {
          const t = TONE[sizeOf(c.ref)] ?? TONE.label;
          const x = c.x * S, y = c.y * S, w = c.w * S, h = c.h * S;
          const title = titleOf(c.ref);
          const fs = Math.max(5, Math.min(9, Math.min(w, h) / 4.5));
          const max = Math.max(3, Math.floor((c.round ? w * 0.7 : w - 6) / (fs * 0.55)));
          return (
            <g key={i}>
              {c.round
                ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2 - 0.5} ry={h / 2 - 0.5} fill={t.fill} stroke={cut ? t.edge : "#c9ccd3"} strokeWidth={0.75} />
                : <rect x={x + 0.4} y={y + 0.4} width={w - 0.8} height={h - 0.8} rx={2} fill={t.fill} stroke={cut ? t.edge : "#c9ccd3"} strokeWidth={0.75} />}
              <text x={x + w / 2} y={y + h / 2 + fs / 3} fontSize={fs} textAnchor="middle" fill="#2e1219">{title.length > max ? `${title.slice(0, max - 1)}…` : title}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="text-center text-[12px] text-ink-2">Sheet {n}</figcaption>
    </figure>
  );
}

