"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, FileText, ImageIcon, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { qrSVG } from "@/lib/qr/render";
import { breakdown, money, SIZE_NAME, SIZE_INCHES, type SizeKey } from "@/lib/earnings";
import { BrushStroke } from "@/components/af/Brush";
import {
  BG, COLOR_NAMES, CTAS, DISCOUNTS, DOTS, EYE, EYES, FG, FORMATS, PRESETS, TAG,
  cardSVG, contrast, ctaText, eyeColor, fmtDist, lum, presetLook, qrValue, renderCard, scanNumbers, sheetSVG,
  type ArtInfo, type Card, type Design, type FormatKey, type PresetKey,
} from "./card";
import { loadFonts, type Fonts } from "./text";
import ArtPicker from "./ArtPicker";
import s from "./qr-studio.module.css";

type View = "card" | "wall" | "sheet";
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export default function QrStudio({ arts, initialSlug, initialDesign, initialCard, base }: {
  arts: ArtInfo[];
  initialSlug: string;
  initialDesign: Design;
  initialCard: { svg: string; sheet: string } | null;
  base: string;
}) {
  const [slug, setSlug] = useState(initialSlug);
  const [d, setD] = useState<Design>(initialDesign);
  const [view, setView] = useState<View>("card");
  const [fonts, setFonts] = useState<Fonts | null>(null);
  const [busy, setBusy] = useState<"" | "pdf" | "all" | "png">("");
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

  useEffect(() => { loadFonts().then(setFonts).catch(() => toast.error("Could not load the card fonts. Refresh to try again.")); }, []);

  const art = arts.find((a) => a.slug === slug) || arts[0];
  // Discounts only work with a server-made signature, so ask for one whenever the deal changes.
  const sigKey = d.disc ? `${art.slug}|${d.disc}|${d.ev.trim()}` : "";
  const [sigs, setSigs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!sigKey || sigs[sigKey]) return;
    const t = setTimeout(() => {
      fetch("/api/qr/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: art.slug, disc: d.disc, ev: d.ev }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j?.sig) setSigs((o) => ({ ...o, [sigKey]: j.sig })); })
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [sigKey, sigs, art.slug, d.disc, d.ev]);
  const qrText = qrValue(d, art.slug, base, sigKey ? sigs[sigKey] : null);
  const card: Card | null = useMemo(() => (fonts ? renderCard(d, art, fonts, qrText) : null), [d, art, fonts, qrText]);
  const svg = card ? cardSVG(card) : initialCard?.svg || "";

  const set = (patch: Partial<Design>) => setD((o) => ({ ...o, preset: "custom", ...patch }));
  const pick = (a: ArtInfo) => {
    setSlug(a.slug);
    try { const u = new URL(window.location.href); u.searchParams.set("art", a.slug); window.history.replaceState(null, "", u); } catch { /* ignore */ }
  };

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
      const r = await fetch("/api/qr/print", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(all ? { all: true, design: d } : { slug: art.slug, design: d }) });
      if (!r.ok) throw new Error(await r.text());
      save(await r.blob(), all ? `artfinity-all-codes-${d.format}.pdf` : `${fileBase}-sheet.pdf`);
    } catch {
      toast.error("The PDF didn't download. Try again.");
    } finally { setBusy(""); }
  }
  function downloadSvg() {
    if (!card) return;
    save(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${cardSVG(card)}`], { type: "image/svg+xml" }), `${fileBase}.svg`);
  }
  async function downloadPng() {
    setBusy("png");
    try {
      const code = qrSVG(qrText, { fg: d.fg, dots: d.dots, eyes: d.eyes, eyeColor: eyeColor(d), label: "QR code", logo: d.logo }).replace("<svg ", '<svg width="1200" height="1200" ');
      const img = new Image();
      const url = URL.createObjectURL(new Blob([code], { type: "image/svg+xml" }));
      await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url; });
      const c = document.createElement("canvas");
      c.width = c.height = 1200;
      const g = c.getContext("2d")!;
      g.fillStyle = d.bg; g.fillRect(0, 0, 1200, 1200); g.drawImage(img, 0, 0, 1200, 1200);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
      if (blob) save(blob, `${art.slug}-code.png`);
    } catch {
      toast.error("The PNG didn't download. Try again.");
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
                    <span className={s.mini} style={{ background: p.bg }} aria-hidden="true">
                      <i style={{ right: "12%", top: "18%", width: "28%", aspectRatio: "1", background: p.fg, borderRadius: 2 }} />
                      <i style={{ left: "10%", top: "22%", width: "42%", height: "18%", background: p.fg, borderRadius: 2 }} />
                      <i style={{ left: "10%", top: "52%", width: "24%", height: "24%", background: p.tag, borderRadius: 2, transform: "rotate(-6deg)" }} />
                    </span>
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
              <select value={d.disc} onChange={(e) => {
                const v = +e.target.value;
                set({ disc: v, coupon: /^SCAN\d*$/.test(d.coupon) || !d.coupon ? (v ? `SCAN${v}` : "") : d.coupon });
              }}>
                {DISCOUNTS.map((v) => <option key={v} value={v}>{v ? `${v}% off` : "No discount"}</option>)}
              </select>
            </label>
            {d.disc > 0 && (
              <>
                <label className={s.field}>Name in your stats
                  <input type="text" maxLength={16} value={d.coupon} onChange={(e) => set({ coupon: e.target.value.toUpperCase().replace(/\s+/g, "") })} />
                </label>
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
            <label className={s.field}>Event or venue
              <input type="text" maxLength={32} value={d.ev} placeholder="River Arts Market" onChange={(e) => set({ ev: e.target.value })} />
              <small>Shows in your stats and on the buyer&rsquo;s page.</small>
            </label>
            <Toggle checked={d.evPrint} disabled={!d.ev.trim()} onChange={(v) => set({ evPrint: v })}>Print it on the card too</Toggle>
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
          </Group>
        </form>

        <div className={s.out}>
          <div className={s.topRow}>
            <div className={s.tabs} role="tablist" aria-label="Preview">
              {([["card", "Card"], ["wall", "On the wall"], ["sheet", "Print sheet"]] as [View, string][]).map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>
            <div className={s.downloads}>
              <button type="button" className="btn btn-blue btn-sm" onClick={() => downloadPdf()} disabled={!!busy}>
                {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
                Download PDF
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadSvg} disabled={!card || !!busy}>
                <Download className="h-4 w-4" aria-hidden="true" /> SVG
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadPng} disabled={!!busy} title="The code alone, 1200 px">
                {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImageIcon className="h-4 w-4" aria-hidden="true" />} Code PNG
              </button>
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
            <Earnings d={d} art={art} />
            <section className={cx(s.panel, s.wide)} aria-labelledby="qs-inside-h">
              <h2 id="qs-inside-h"><span className="paint-dab" style={{ ["--dab" as string]: "#2b37f0" }} aria-hidden="true" />What&rsquo;s inside the code</h2>
              <a className={s.link} href={qrText} target="_blank" rel="noreferrer">{qrText}</a>
              <dl className={s.record}>
                <dt>Opens</dt><dd>{art.title}</dd>
                <dt>Venue</dt><dd>{d.ev.trim() ? <>{d.ev.trim()}{d.evPrint ? "" : " (not printed)"}</> : "None"}</dd>
                <dt>Discount</dt><dd>{d.disc ? <>{d.disc}% off at checkout{d.coupon ? ` · ${d.coupon}` : ""}</> : "None"}</dd>
                <dt>Words</dt><dd>{ctaText(d)}</dd>
                <dt>Look</dt><dd>{F.name} · {DOTS[d.dots]} dots · {EYES[d.eyes]} corners</dd>
              </dl>
              <p className={s.soon}>
                <span className="sticker-badge">Short links coming soon</span>
                <span>Then you can change the deal, size ({SIZE_NAME[d.size]} first) and end date ({d.end === "never" ? "never" : d.end === "event" ? "event ends" : "30 days"}) after printing.</span>
              </p>
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

function Earnings({ d, art }: { d: Design; art: ArtInfo }) {
  const m = art.markups[d.size] || 0;
  const full = breakdown(d.size, m, 0), sale = breakdown(d.size, m, d.disc);
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
          <tr className={s.you}><td>You (60%)</td><td>{money(full.artist)}</td>{d.disc > 0 && <td>{money(sale.artist)}</td>}</tr>
          <tr><td>Artfinity (40%)</td><td>{money(full.company)}</td>{d.disc > 0 && <td>{money(sale.company)}</td>}</tr>
        </tbody>
      </table>
      {d.disc > 0 && (
        <p className={s.note}>The discount comes off the sale price, so we both earn less: you {money(full.artist - sale.artist)}, Artfinity {money(full.company - sale.company)}. Printing costs don&rsquo;t change.</p>
      )}
    </section>
  );
}
