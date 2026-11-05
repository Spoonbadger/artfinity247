"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Download, FileText, ImageIcon, Layers, Loader2, Plus } from "lucide-react";
import { errorText, failed, problemFrom, saved as savedToast } from "@/lib/feedback";
import { qrSVG } from "@/lib/qr/render";
import { breakdown, money, SIZE_NAME, SIZE_INCHES, type SizeKey } from "@/lib/earnings";
import { getArtistSplit } from "@/lib/revenue";
import { BrushStroke } from "@/components/af/Brush";
import { PLACEHOLDER_CODE, shortLabel, shortUrl } from "@/lib/shortcode";
import {
  BG, COLOR_NAMES, CTAS, DISCOUNTS, DOTS, EYE, EYES, FG, FORMATS, PRESETS, TAG,
  cardSVG, contrast, eyeColor, fmtDist, lum, presetLook, qrValue, renderCard, scanNumbers, sheetSVG,
  type ArtInfo, type Card, type Design, type FormatKey, type PresetKey,
} from "./card";
import { loadFonts, type Fonts } from "./text";
import ArtPicker from "./ArtPicker";
import VenuePicker, { type VenueChoice } from "@/components/codes/VenuePicker";
import s from "./qr-studio.module.css";

type View = "card" | "wall" | "sheet";
/** A short link code already saved for one artwork (opened from My codes). */
export type SavedCode = { code: string; slug: string; label: string; expiresAt: string | null; venueId?: string | null };
const JSON_HEADERS = { "Content-Type": "application/json" };
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function QrStudio({ arts, initialSlug, initialDesign, initialCard, base, initialSaved = null, split, handle, venues = [] }: {
  /** Partner venues for the venue picker (lib/venues.ts). */
  venues?: VenueChoice[];
  /** The artist's handle, for the full artwork link. */
  handle?: string;
  /** The artist's current share of profit (Infinity pays more). */
  split?: number;
  arts: ArtInfo[];
  initialSlug: string;
  initialDesign: Design;
  initialCard: { svg: string; sheet: string } | null;
  base: string;
  initialSaved?: SavedCode | null;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [d, setD] = useState<Design>(initialDesign);
  const [view, setView] = useState<View>("card");
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "all" | "png" | "svg" | "save">("");
  // Short link codes saved this visit, by artwork. A code is made on the first download or "Save code";
  // later downloads of the same piece update that code's record instead of making another.
  const [codes, setCodes] = useState<Record<string, string>>(initialSaved ? { [initialSaved.slug]: initialSaved.code } : {});
  const [label, setLabel] = useState(initialSaved?.label || "");
  const [endDate, setEndDate] = useState(initialSaved?.expiresAt ? initialSaved.expiresAt.slice(0, 10) : "");
  const [venueId, setVenueId] = useState<string | null>(initialSaved?.venueId ?? null);
  // What each saved code was last saved with, to tell "Saved" from "Save changes".
  const [snaps, setSnaps] = useState<Record<string, string>>(() =>
    initialSaved ? { [initialSaved.slug]: JSON.stringify([initialSaved.label || "", initialDesign, initialSaved.expiresAt ? initialSaved.expiresAt.slice(0, 10) : "", initialSaved.venueId ?? null]) } : {});
  const customRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [stageHidden, setStageHidden] = useState(false);
  const [formShown, setFormShown] = useState(false);

  // On narrow screens the controls sit under the preview: float a small copy while it's off screen.
  useEffect(() => {
    const el = stageRef.current, form = formRef.current;
    if (!el || !form || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStageHidden(!e.isIntersecting), { rootMargin: "-120px 0px 0px 0px" });
    const fo = new IntersectionObserver(([e]) => setFormShown(e.isIntersecting), { rootMargin: "0px 0px -160px 0px" });
    io.observe(el); fo.observe(form);
    return () => { io.disconnect(); fo.disconnect(); };
  }, []);

  useEffect(() => { loadFonts().then(setFonts).catch(() => failed("Could not load the card fonts", { description: "The PDF still works. Refresh to get SVG downloads back.", fix: { label: "Refresh", href: window.location.pathname + window.location.search } })); }, []);

  const art = arts.find((a) => a.slug === slug) || arts[0];
  // The code holds only a short link. Before it's saved, the preview uses a same-length placeholder.
  const code = codes[art.slug] || null;
  const qrText = qrValue(d, art.slug, base, null, code || PLACEHOLDER_CODE, handle);
  const card: Card | null = useMemo(() => (fonts ? renderCard(d, art, fonts, qrText) : null), [d, art, fonts, qrText]);
  const svg = card ? cardSVG(card) : initialCard?.svg || "";
  // Each preset button shows the real card it makes, for this piece, so the choice is what you see.
  const presetThumbs = useMemo(() => {
    const out: Partial<Record<PresetKey, string>> = {};
    if (!fonts) return out;
    for (const k of Object.keys(PRESETS) as PresetKey[]) {
      try {
        const c = renderCard({ ...d, ...presetLook(k), preset: k }, art, fonts, qrText, `pt-${k}`);
        out[k] = cardSVG(c).replace(/ role="img" aria-label="[^"]*"/, "").replace(/width="[^"]*in" height="[^"]*in"/, "");
      } catch { /* the button falls back to its name */ }
    }
    return out;
  }, [fonts, art, qrText, d]);

  const set = (patch: Partial<Design>) => setD((o) => ({ ...o, preset: "custom", ...patch }));
  const pick = (a: ArtInfo) => {
    setSlug(a.slug);
    try { const u = new URL(window.location.href); u.searchParams.set("art", a.slug); window.history.replaceState(null, "", u); } catch { /* ignore */ }
  };

  // ---------------- short link code ----------------
  const defaultLabel = d.ev.trim() || `${art.title} · ${FORMATS[d.format].name}`;
  function expiresAt() {
    if (d.end === "30") return new Date(Date.now() + 30 * 86400000).toISOString();
    if (d.end === "event" && endDate) return new Date(`${endDate}T23:59:59`).toISOString();
    return null;
  }
  const snapshot = JSON.stringify([label, d, endDate, venueId]);
  const dirty = !!code && snaps[art.slug] !== undefined && snaps[art.slug] !== snapshot;
  const codeMeta = () => ({ label: label.trim() || defaultLabel, venue: d.ev.trim() || null, venueId, discountPct: d.disc || null, expiresAt: expiresAt(), design: d });
  /** Save (or update) this piece's code with the current look, venue, deal and end date. */
  async function ensureCode(): Promise<string | null> {
    const existing = codes[art.slug];
    const snap = snapshot;
    try {
      const r = await fetch(existing ? `/api/qr/codes/${existing}` : "/api/qr/codes", {
        method: existing ? "PATCH" : "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(existing ? codeMeta() : { artworkSlug: art.slug, ...codeMeta() }),
      });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't save the code. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => { void saveCode(); } });
        return null;
      }
      const j = await r.json().catch(() => ({}));
      const c: string = existing || j.code;
      setCodes((o) => ({ ...o, [art.slug]: c }));
      setSnaps((o) => ({ ...o, [art.slug]: snap }));
      return c;
    } catch (e) {
      failed(errorText(e, "Couldn't save the code. Try again."), { retry: () => { void saveCode(); } });
      return null;
    }
  }
  async function saveCode() {
    setBusy("save");
    const c = await ensureCode();
    setBusy("");
    if (c) savedToast(`Saved as ${c}`, { description: "Change it any time in My codes.", next: { label: "My codes", href: `/studio/codes/${c}` } });
  }
  function newCode() {
    setCodes((o) => { const n = { ...o }; delete n[art.slug]; return n; });
    setLabel("");
  }

  // ---------------- downloads ----------------
  const fileBase = `${art.slug}-${d.format}`;
  function save(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function downloadPdf(all = false) {
    setBusy(all ? "all" : "pdf");
    try {
      let body: Record<string, unknown>;
      if (all) {
        const m = codeMeta();
        body = { all: true, design: d, venue: m.venue, venueId: m.venueId, discountPct: m.discountPct, expiresAt: m.expiresAt };
      } else {
        const c = await ensureCode();
        if (!c) return;
        body = { slug: art.slug, design: d, code: c };
      }
      const r = await fetch("/api/qr/print", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
      if (!r.ok) {
        const p = await problemFrom(r, "The PDF didn't download. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => { void downloadPdf(all); } });
        return;
      }
      save(await r.blob(), all ? `artfinity-all-codes-${d.format}.pdf` : `${fileBase}-sheet.pdf`);
      if (all) savedToast(`Made ${r.headers.get("X-Af-Codes") || arts.length} codes`, { description: "One per piece. See them in My codes.", next: { label: "My codes", href: "/studio/codes" } });
      else savedToast("Print sheet downloaded", { description: "Its code is saved in My codes. Print at 100% scale.", next: { label: "My codes", href: "/studio/codes" } });
    } catch (e) {
      failed(errorText(e, "The PDF didn't download. Try again."), { retry: () => { void downloadPdf(all); } });
    } finally { setBusy(""); }
  }
  async function downloadSvg() {
    if (!fonts) return;
    setBusy("svg");
    try {
      const c = await ensureCode();
      if (!c) return;
      const out = renderCard(d, art, fonts, shortUrl(c, base));
      save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${cardSVG(out)}`], { type: "image/svg+xml" }), `${fileBase}.svg`);
      savedToast("SVG downloaded", { description: `Code ${c} is saved in My codes.` });
    } catch (e) {
      failed(errorText(e, "The SVG didn't download. Try again."), { retry: () => { void downloadSvg(); } });
    } finally { setBusy(""); }
  }
  async function downloadPng() {
    setBusy("png");
    try {
      const c = await ensureCode();
      if (!c) return;
      const code = qrSVG(shortUrl(c, base), { fg: d.fg, dots: d.dots, eyes: d.eyes, eyeColor: eyeColor(d), label: "QR code", logo: d.logo }).replace("<svg ", '<svg width="1200" height="1200" ');
      const img = new Image();
      const url = URL.createObjectURL(new Blob([code], { type: "image/svg+xml" }));
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
      const cv = document.createElement("canvas");
      cv.width = cv.height = 1200;
      const g = cv.getContext("2d")!;
      g.fillStyle = d.bg; g.fillRect(0, 0, 1200, 1200); g.drawImage(img, 0, 0, 1200, 1200);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
      if (!blob) throw new Error("The PNG didn't download. Try again.");
      save(blob, `${art.slug}-${c}.png`);
      savedToast("Code PNG downloaded", { description: `Code ${c} is saved in My codes.` });
    } catch (e) {
      failed(errorText(e, "The PNG didn't download. Try again."), { retry: () => { void downloadPng(); } });
    } finally { setBusy(""); }
  }

  const F = FORMATS[d.format];
  const sn = card && fonts ? scanNumbers(card, qrText, fonts, d.logo) : null;

  return (
    <div className={s.wrap}>
      <ArtPicker arts={arts} slug={art.slug} onPick={pick} />

      <div className={s.studio}>
        <form ref={formRef} className={s.ctl} onSubmit={(e) => e.preventDefault()} autoComplete="off" aria-label="Card options">
          <Group title="Start from" dab="#ffd43b">
            <div className={s.presets} role="group" aria-label="Preset">
              {(Object.keys(PRESETS) as PresetKey[]).map((k) => {
                const p = PRESETS[k];
                return (
                  <button key={k} type="button" aria-pressed={d.preset === k} onClick={() => setD((o) => ({ ...o, ...presetLook(k), preset: k }))}>
                    <span className={s.mini} aria-hidden="true" dangerouslySetInnerHTML={{ __html: presetThumbs[k] || "" }} />
                    <span>{p.name}<small>{p.sub}</small></span>
                  </button>
                );
              })}
            </div>
          </Group>

          <Group title="What it says" dab="#2b37f0">
            <Chips label="Button text" items={CTAS} value={d.cta} onPick={(k) => { set({ cta: k }); if (k === "custom") setTimeout(() => customRef.current?.focus(), 0); }} />
            {d.cta === "custom" && (
              <label className={s.field}>Your own words
                <input ref={customRef} type="text" maxLength={28} value={d.ctaCustom} onChange={(e) => set({ ctaCustom: e.target.value })} />
              </label>
            )}
            <Toggle checked={d.showTitle} onChange={(v) => set({ showTitle: v })}>Title and artist</Toggle>
            <Toggle checked={d.showPrice} onChange={(v) => set({ showPrice: v })}>&ldquo;Prints from&rdquo; price</Toggle>
            <Toggle checked={d.showBrand} onChange={(v) => set({ showBrand: v })}>Artfinity name</Toggle>
          </Group>

          <Group title="Discount" dab="#ff5a36">
            <label className={s.field}>For people who scan
              <select value={d.disc} onChange={(e) => set({ disc: +e.target.value })}>
                {DISCOUNTS.map((v) => <option key={v} value={v}>{v ? `${v}% off` : "No discount"}</option>)}
              </select>
            </label>
            {d.disc > 0 && (
              <>
                <div className={s.sub}>Tag color</div>
                <Swatches label="Tag color" list={TAG} value={d.tag} onPick={(c) => set({ tag: c })} fg={d.fg} />
              </>
            )}
          </Group>

          <Group title="Look" dab="#7b2d8e">
            <div className={s.sub}>Format</div>
            <Chips label="Format" items={(Object.keys(FORMATS) as FormatKey[]).map((k) => [k, FORMATS[k].name])} value={d.format} onPick={(k) => set({ format: k })} />
            <div className={s.sub}>Dots</div>
            <Chips label="Dot shape" items={Object.entries(DOTS) as [Design["dots"], string][]} value={d.dots} onPick={(k) => set({ dots: k })} />
            <div className={s.sub}>Corners</div>
            <Chips label="Corner shape" items={Object.entries(EYES) as [Design["eyes"], string][]} value={d.eyes} onPick={(k) => set({ eyes: k })} />
            <Toggle checked={d.logo} onChange={(v) => set({ logo: v })}>Show Artfinity logo in the code</Toggle>
            <div className={s.sub}>Corner color</div>
            <Swatches label="Corner color" list={EYE} value={d.eye} onPick={(c) => set({ eye: c })} fg={d.fg} noCustom />
            <div className={s.sub}>Code color</div>
            <Swatches label="Code color" list={FG} value={d.fg} onPick={(c) => set({ fg: c })} fg={d.fg} />
            <div className={s.sub}>Card color</div>
            <Swatches label="Card color" list={BG} value={d.bg} onPick={(c) => set({ bg: c })} fg={d.fg} />
          </Group>

          <Group title="Behind the code" dab="#0f7a55">
            <label className={s.field}>Name it
              <input type="text" maxLength={60} value={label} placeholder={defaultLabel} onChange={(e) => setLabel(e.target.value)} />
              <small>Only you see this, in My codes.</small>
            </label>
            <VenuePicker
              venues={venues} value={{ venueId, venue: d.ev }} maxLength={32} label="Event or venue" fieldClass={s.field} labelClass={null}
              hint={<>Shows in your stats and on the buyer&rsquo;s page.</>}
              onChange={(v) => { setVenueId(v.venueId); set({ ev: v.venue }); }}
            />
            <Toggle checked={d.evPrint} disabled={!d.ev.trim()} onChange={(v) => set({ evPrint: v })}>Print it on the card too</Toggle>
            {!d.ev.trim() && <small className="-mt-1 block text-[12.5px] text-ink-2">Pick a venue or event above to print its name on the card.</small>}
            <label className={s.field}>Size shown first
              <select value={d.size} onChange={(e) => set({ size: e.target.value as SizeKey })}>
                {(Object.keys(SIZE_NAME) as SizeKey[]).map((k) => <option key={k} value={k}>{SIZE_NAME[k]} · {SIZE_INCHES[k]}</option>)}
              </select>
            </label>
            <label className={s.field}>Code stops working
              <select value={d.end} onChange={(e) => set({ end: e.target.value as Design["end"] })}>
                <option value="never">Never</option>
                <option value="event">When the event ends</option>
                <option value="30">30 days after printing</option>
              </select>
            </label>
            {d.end === "event" && (
              <label className={s.field}>Last day of the event
                <input type="date" value={endDate} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setEndDate(e.target.value)} />
                <small>{endDate ? "Scans after this open your page instead." : "Pick a day, or the code keeps working."}</small>
              </label>
            )}
          </Group>
        </form>

        <div className={s.out}>
          <div className={s.topRow}>
            <div className={s.tabs} role="tablist" aria-label="Preview">
              {([["card", "Card"], ["wall", "On the wall"], ["sheet", "Print sheet"]] as [View, string][]).map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>
          </div>

          <div className={s.stage} aria-live="polite" data-view={view} ref={stageRef}>
            {!svg ? <div className={s.loading}><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> Mixing paint</div>
              : view === "card" ? <div className={cx(s.face, s[`f_${d.format}`])} dangerouslySetInnerHTML={{ __html: svg }} />
              : view === "wall" ? <Wall art={art} svg={svg} format={d.format} />
              : <div className={s.sheet} dangerouslySetInnerHTML={{ __html: card ? sheetSVG(card, d.format) : initialCard?.sheet || "" }} />}
          </div>
          <p className={s.stageNote}>
            {view === "card" && <>{F.name} · {F.w} × {F.h} in · shown larger than life</>}
            {view === "wall" && <>To scale on an 8 ft wall, beside a 24 × 30 in original{sn && <>. Words read from {fmtDist(sn.readM * 100)}, code scans from {fmtDist(sn.scanCm)}</>}.</>}
            {view === "sheet" && <>{F.sheet.note} US Letter, 100% scale{d.format === "poster" ? "" : ", crop marks included"}.</>}
          </p>
          <div className={s.downloads}>
              <button type="button" className="btn btn-blue btn-sm" onClick={() => downloadPdf()} disabled={!!busy}>
                {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                Download PDF
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadSvg} disabled={!fonts || !!busy}>
                {busy === "svg" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />} SVG
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadPng} disabled={!!busy} title="The code alone, 1200 px">
                {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-4 w-4" aria-hidden="true" />} Code PNG
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={saveCode} disabled={!!busy} title="Save the code without downloading">
                {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : code && !dirty ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                {code ? (dirty ? `Save changes · ${code}` : `Saved · ${code}`) : "Save code"}
              </button>
            </div>
          {arts.length > 1 && (
            <div className={s.printAll}>
              <span>Every piece, this look:</span>
              <button type="button" className="btn btn-sticker btn-sm" onClick={() => downloadPdf(true)} disabled={!!busy}>
                {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Layers className="h-4 w-4" aria-hidden="true" />}
                Print all my codes ({arts.length})
              </button>
            </div>
          )}
        </div>

        {stageHidden && formShown && svg && (
          <button type="button" className={cx(s.floater, s[`fl_${d.format}`])} onClick={() => stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} aria-label="Back to the preview">
            <span dangerouslySetInnerHTML={{ __html: svg.replace(/ role="img" aria-label="[^"]*"/, ' aria-hidden="true"') }} />
          </button>
        )}

        <div className={cx(s.out, s.panelsWrap)}>
          <div className={s.panels}>
            <section className={s.panel} aria-labelledby="qs-scan-h">
              <h2 id="qs-scan-h"><span className="paint-dab" style={{ ["--dab" as string]: "#0f7a55" }} aria-hidden="true" />Will it scan?</h2>
              {sn ? <Checks d={d} sn={sn} /> : <p className={s.note}>Checking…</p>}
            </section>
            <Earnings d={d} art={art} split={split} />
            <section className={cx(s.panel, s.wide)} aria-labelledby="qs-inside-h">
              <h2 id="qs-inside-h"><span className="paint-dab" style={{ ["--dab" as string]: "#2b37f0" }} aria-hidden="true" />What&rsquo;s inside the code</h2>
              <a className={s.link} href={code ? shortUrl(code, base) : undefined} target="_blank" rel="noreferrer" aria-disabled={!code || undefined}>
                {code ? shortLabel(code, base) : shortLabel("····", base)}
              </a>
              <dl className={s.record}>
                <dt>Code</dt><dd>{code ? <b>{code}</b> : "Made when you download or save"}</dd>
                <dt>Opens</dt><dd>{art.title}</dd>
                <dt>Venue</dt><dd>{d.ev.trim() ? <>{d.ev.trim()}{d.evPrint ? "" : " (not printed)"}</> : "None"}</dd>
                <dt>Discount</dt><dd>{d.disc ? <>{d.disc}% off at checkout</> : "None"}</dd>
                <dt>Ends</dt><dd>{d.end === "never" ? "Never" : d.end === "30" ? "30 days after printing" : endDate ? new Date(`${endDate}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "When the event ends"}</dd>
                <dt>Look</dt><dd>{F.name} · {DOTS[d.dots]} dots · {EYES[d.eyes]} corners</dd>
              </dl>
              <p className={s.soon}>
                <span className="sticker-badge">Editable any time</span>
                <span>The code holds only a short link. Change the artwork, deal, venue or end date after printing{code ? <> in <Link href={`/studio/codes/${code}`} className="font-bold text-scan">My codes</Link></> : " in My codes"}.</span>
              </p>
              {code && (
                <button type="button" className="btn btn-ghost btn-sm justify-self-start" onClick={newCode}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> New code for this piece
                </button>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- pieces ----------------
function Group({ title, dab, children }: { title: string; dab: string; children: ReactNode }) {
  return (
    <fieldset className={s.group}>
      <legend><span className="paint-dab" style={{ ["--dab" as string]: dab }} aria-hidden="true" />{title}</legend>
      <div className={s.groupBody}>{children}</div>
    </fieldset>
  );
}

function Chips<K extends string>({ label, items, value, onPick }: { label: string; items: [K, string][]; value: K; onPick: (k: K) => void }) {
  return (
    <div className={s.chips} role="group" aria-label={label}>
      {items.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onPick(k)}>{l}</button>)}
    </div>
  );
}

function Toggle({ checked, onChange, disabled, children }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className={cx(s.toggle, disabled && s.disabled)}>
      <input type="checkbox" checked={checked && !disabled} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />{children}
    </label>
  );
}

function Swatches({ label, list, value, onPick, fg, noCustom }: { label: string; list: string[]; value: string; onPick: (c: string) => void; fg: string; noCustom?: boolean }) {
  const custom = !list.includes(value);
  return (
    <div className={s.colors} role="group" aria-label={label}>
      {list.map((c, i) => {
        const same = c === "same";
        return (
          <button key={c} type="button" aria-pressed={value === c} aria-label={COLOR_NAMES[c] || c} title={COLOR_NAMES[c] || c}
            style={{ background: same ? fg : c, ["--r" as string]: `${(i * 37) % 50 - 20}deg`, boxShadow: same ? `inset 0 0 0 5px ${lum(fg) > 0.5 ? "#15161b" : "#ffffff"}` : undefined }} />
        );
      })}
      {!noCustom && (
        <label className={cx(s.pick, custom && s.pickOn)} title="Any color">
          <span className="sr-only">{label}: any color</span>
          <input type="color" value={custom ? value : "#888888"} onChange={(e) => onPick(e.target.value)} />
        </label>
      )}
    </div>
  );
}

function Wall({ art, svg, format }: { art: ArtInfo; svg: string; format: FormatKey }) {
  const F = FORMATS[format], WALL = 96;
  const pw = (24 / WALL) * 100, ph = (30 / WALL) * 100 * 1.6;
  const cw = (F.w / WALL) * 100;
  const top = format === "poster" ? 30 : 46;
  return (
    <div className={s.wall} role="img" aria-label={`To scale: ${art.title}, 24 by 30 inches, with the ${F.name.toLowerCase()} beside it`}>
      <div className={s.orig} style={{ left: "20%", top: "14%", width: `${pw}%`, height: `${ph}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={art.imageUrl} alt="" />
      </div>
      <div className={cx(s.placed, format === "poster" && s.placedPoster)} style={{ left: `${20 + pw + 3}%`, top: `${top}%`, width: `${cw}%` }}>
        <div className={s.wallCard} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      {format !== "poster" && (
        <div className={s.loupe}>
          <div className={cx(s.wallCard, s[`l_${format}`])} dangerouslySetInnerHTML={{ __html: svg }} />
          <span>Up close</span>
        </div>
      )}
      <div className={s.ruler}><i style={{ width: `${(12 / WALL) * 100}%` }} />1 ft</div>
      <div className={s.floor} />
    </div>
  );
}

type SN = ReturnType<typeof scanNumbers>;
function Checks({ d, sn }: { d: Design; sn: SN }) {
  const items: [("ok" | "warn" | "bad"), ReactNode][] = [];
  const c = contrast(d.fg, d.bg);
  items.push(c >= 4.5 ? ["ok", <>Contrast <b>{c.toFixed(1)}:1</b>. Easy for phones.</>]
    : c >= 3 ? ["warn", <>Contrast <b>{c.toFixed(1)}:1</b>. Darker code or lighter card is safer.</>]
    : ["bad", <>Contrast <b>{c.toFixed(1)}:1</b> is too low. Pick a darker code or lighter card.</>]);
  if (lum(d.fg) > lum(d.bg)) items.push(["warn", <>Light code on a dark card. New phones read it; some old scanner apps don&rsquo;t.</>]);
  const ec = eyeColor(d);
  if (ec && contrast(ec, d.bg) < 3) items.push(["warn", <>Corners are close to the card color. Phones find the code by its corners.</>]);
  const mm = sn.modMm;
  items.push(mm >= 0.8 ? ["ok", <>Dots print at <b>{mm.toFixed(2)} mm</b>. Above the 0.8 mm we aim for.</>]
    : mm >= 0.5 ? ["warn", <>Dots print at <b>{mm.toFixed(2)} mm</b>. Fine up close; go bigger if it hangs high.</>]
    : ["bad", <>Dots print at <b>{mm.toFixed(2)} mm</b>. Too small. Pick a bigger format.</>]);
  items.push(["ok", <>Scans from about <b>{fmtDist(sn.scanCm)}</b>. Words read from <b>{fmtDist(sn.readM * 100)}</b>.{d.format !== "poster" ? " For a door or across a room, use the poster." : ""}</>]);
  if ((d.dots === "dots" || d.dots === "diamond") && mm < 0.9) items.push(["warn", <>{DOTS[d.dots]} leaves more white space. Square or Soft are safest this small.</>]);
  if (d.disc && contrast(d.tag, d.bg) < 1.4) items.push(["warn", <>The tag matches the card. Pick a tag color that stands out.</>]);
  return (
    <ul className={s.checks}>
      {items.map(([k, t], i) => <li key={i} className={s[k]}><i aria-hidden="true">{k === "ok" ? "✓" : "!"}</i><span><span className="sr-only">{k === "ok" ? "Good: " : k === "warn" ? "Heads up: " : "Problem: "}</span>{t}</span></li>)}
    </ul>
  );
}

function Earnings({ d, art, split }: { d: Design; art: ArtInfo; split?: number }) {
  const m = art.markups[d.size] || 0;
  const now = new Date();
  const full = breakdown(d.size, m, 0, false, now, split), sale = breakdown(d.size, m, d.disc, false, now, split);
  const youShare = split ?? getArtistSplit(now);
  const pctOf = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <section className={s.panel} aria-labelledby="qs-earn-h">
      <h2 id="qs-earn-h"><span className="paint-dab" style={{ ["--dab" as string]: "#0f7a55" }} aria-hidden="true" />Each sale pays you</h2>
      <div className={s.big}>
        <span className="num">{money(sale.artist)}</span>
        <BrushStroke className={s.bigStroke} color="var(--af-earned-soft)" />
      </div>
      <p className={s.note}>per {SIZE_NAME[d.size]} print ({SIZE_INCHES[d.size]}) sold through this code.</p>
      <table className={s.earn}>
        {d.disc > 0 && <thead><tr><th><span className="sr-only">Who</span></th><th>Full price</th><th>{d.disc}% off</th></tr></thead>}
        <tbody>
          <tr><td>Buyer pays</td><td>{money(full.price)}</td>{d.disc > 0 && <td>{money(sale.price)}</td>}</tr>
          <tr className={s.you}><td>You ({pctOf(youShare)})</td><td>{money(full.artist)}</td>{d.disc > 0 && <td>{money(sale.artist)}</td>}</tr>
          <tr><td>Artfinity ({pctOf(1 - youShare)})</td><td>{money(full.company)}</td>{d.disc > 0 && <td>{money(sale.company)}</td>}</tr>
        </tbody>
      </table>
      {d.disc > 0 && (
        <p className={s.note}>The discount comes off the sale price, so we both earn less: you {money(full.artist - sale.artist)}, Artfinity {money(full.company - sale.company)}. Printing costs don&rsquo;t change.</p>
      )}
    </section>
  );
}
