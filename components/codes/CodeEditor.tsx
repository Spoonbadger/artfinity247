"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorText, failed, problemFrom, saved } from "@/lib/feedback";
import { Download, ImageIcon, Loader2, Pencil } from "lucide-react";
import { qrSVG, type DotStyle, type EyeStyle } from "@/lib/qr/render";
import { shortUrl } from "@/lib/shortcode";
import PlacePicker, { placeInput, samePlace, type PartnerChoice, type PlaceChoice, type PlaceValue } from "./PlacePicker";
import LabelWarning, { queueReprint, type LabelWarningText } from "./LabelWarning";
import { describeChange, nowFacts, type PrintedLabel } from "@/lib/labelFacts";
import { QR_END_DATES } from "@/lib/features";

export type EditableCode = {
  code: string;
  label: string;
  /** Where it hangs (its Place). */
  place: PlaceValue;
  discountPct: number | null;
  active: boolean;
  expiresAt: string | null; // ISO
  artworkId: string | null;
};
/** smallCents: the artwork's small print markup, for the "Prints from" price a reprint would show. */
export type CodeArt = { id: string; title: string; imageUrl: string; smallMarkup?: number };
export type CodeLook = { fg: string; bg: string; dots: DotStyle; eyes: EyeStyle; eye: string | null; logo: boolean; printedDisc: number; printedVenue: string | null };

const STEPS = [5, 10, 15, 20, 25, 30];

const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Edit what's behind a printed code, and download the code again. */
export default function CodeEditor({ initial, arts, look, base, places = [], partners = [], label = null }: {
  initial: EditableCode; arts: CodeArt[]; look: CodeLook; base: string;
  places?: PlaceChoice[]; partners?: PartnerChoice[];
  /** This code's latest printed label (lib/labelStatus.ts), to warn before a change makes it wrong. */
  label?: PrintedLabel | null;
}) {
  const router = useRouter();
  const [f, setF] = useState({ ...initial, expires: dayOf(initial.expiresAt) });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((o) => ({ ...o, ...p }));
  const dirty = f.label !== initial.label || !samePlace(f.place, initial.place) || f.discountPct !== initial.discountPct || f.active !== initial.active || (QR_END_DATES && f.expires !== dayOf(initial.expiresAt)) || f.artworkId !== initial.artworkId;
  // Asked before saving a change that makes the printed label disagree with what scans show.
  const [warn, setWarn] = useState<LabelWarningText | null>(null);
  const [warnBusy, setWarnBusy] = useState<"reprint" | "save" | null>(null);
  const art = arts.find((a) => a.id === f.artworkId) || null;

  const formRef = useRef<HTMLFormElement>(null);
  /** What this code's card would say after the change: the picked artwork's title and price, the new discount. */
  function after(l: PrintedLabel) {
    const a = arts.find((x) => x.id === f.artworkId);
    if (!a) return { priceCents: l.priceCents, discountPct: f.discountPct || 0, title: l.showsTitle ? "Your page" : "" };
    return nowFacts({ design: {}, discountPct: f.discountPct }, { title: a.title.replace(/ \(in review\)$/, ""), markups: { small: a.smallMarkup ?? 0, medium: 0, large: 0, xl: 0 } }, l.showsTitle);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const w = label ? describeChange([label], after) : null;
    if (w) { setWarn(w); return; }
    void persist(false);
  }

  async function persist(reprint: boolean) {
    setBusy(true);
    try {
      const r = await fetch(`/api/qr/codes/${initial.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: f.label, place: placeInput(f.place), discountPct: f.discountPct, active: f.active, artworkId: f.artworkId,
          ...(QR_END_DATES ? { expiresAt: f.expires ? new Date(`${f.expires}T23:59:59`).toISOString() : null } : {}),
        }),
      });
      if (!r.ok) {
        const p = await problemFrom(r, "Couldn't save. Try again.");
        failed(p.message, { fix: p.fix, retry: p.fix ? undefined : () => { void persist(reprint); } });
        return;
      }
      if (reprint) {
        try {
          const q = await queueReprint([initial.code]);
          saved("Saved and added to your print queue", { description: `${q.cards} ${q.cards === 1 ? "card" : "cards"} waiting to print.`, next: { label: "Open print queue", href: "/studio/qr/queue" } });
        } catch (err) {
          failed(errorText(err, "Saved, but it didn't go in the print queue."), { retry: () => { void queueReprint([initial.code]).then(() => saved("Added to your print queue")); } });
        }
      } else saved("Saved", { description: "The printed code opens the new version now." });
      setWarn(null);
      router.refresh();
    } catch (err) {
      failed(errorText(err, "Couldn't save. Try again."), { retry: () => { void persist(reprint); } });
    } finally { setBusy(false); setWarnBusy(null); }
  }

  const url = shortUrl(initial.code, base);
  const svg = useMemo(() => qrSVG(url, { fg: look.fg, dots: look.dots, eyes: look.eyes, eyeColor: look.eye, logo: look.logo, label: `QR code ${initial.code}` }), [url, look, initial.code]);

  function saveBlob(blob: Blob, name: string) {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  async function png() {
    const big = svg.replace("<svg ", '<svg width="1200" height="1200" ');
    const img = new Image();
    const u = URL.createObjectURL(new Blob([big], { type: "image/svg+xml" }));
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = u; });
    const c = document.createElement("canvas");
    c.width = c.height = 1200;
    const g = c.getContext("2d")!;
    g.fillStyle = look.bg; g.fillRect(0, 0, 1200, 1200); g.drawImage(img, 0, 0, 1200, 1200);
    URL.revokeObjectURL(u);
    c.toBlob((b) => b && saveBlob(b, `artfinity-${initial.code}.png`), "image/png");
  }

  const tagWarn = !label && look.printedDisc > 0 && f.discountPct !== look.printedDisc;
  const venueWarn = !!look.printedVenue && f.place.name.trim() !== look.printedVenue;

  return (
    <div className="grid content-start gap-4">
      <form ref={formRef} onSubmit={save} className="af-card grid gap-4 p-4 sm:p-5" aria-labelledby="edit-h">
        <div className="grid gap-1">
          <h2 id="edit-h" className="t-card">Behind the code</h2>
          <p className="t-small">Changes reach the printed code as soon as you save. No reprint needed.</p>
        </div>

        <label className="af-field">
          <span className="label">Name</span>
          <input type="text" maxLength={60} value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="Lumen Café wall" />
        </label>

        <label className="af-field">
          <span className="label">Opens</span>
          <select value={f.artworkId ?? ""} onChange={(e) => set({ artworkId: e.target.value || null })}>
            <option value="">My artist page</option>
            {arts.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        </label>
        {art && (
          <div className="t-small flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.imageUrl} alt={art.title} className="h-12 w-12 rounded-[3px] object-cover" />
            Scans land on {art.title}.
          </div>
        )}

        <PlacePicker places={places} partners={partners} value={f.place} onChange={(place) => set({ place })} label="Hangs at" hint={<>Buyers see &ldquo;You scanned this at …&rdquo;. <Link href="/studio/places" className="font-semibold text-scan">Places</Link></>} />
        {venueWarn && <p className="t-small -mt-2">The card itself still says {look.printedVenue}.</p>}

        <label className="af-field">
          <span className="label">Discount</span>
          <select value={f.discountPct ?? 0} onChange={(e) => set({ discountPct: +e.target.value || null })}>
            <option value={0}>No discount</option>
            {STEPS.map((v) => <option key={v} value={v}>{v}% off</option>)}
          </select>
        </label>
        {tagWarn && <p className="t-small -mt-2">The printed tag still says {look.printedDisc}% off. Buyers get {f.discountPct ? `${f.discountPct}%` : "full price"}.</p>}

        {QR_END_DATES && (
          <>
            <label className="af-field">
              <span className="label">Stops working after</span>
              <input type="date" value={f.expires} onChange={(e) => set({ expires: e.target.value })} />
            </label>
            <div className="t-small -mt-2 flex items-center justify-between gap-2">
              <span>{f.expires ? "Then it opens your page with a short note." : "Never ends."}</span>
              {f.expires && <button type="button" className="font-bold text-scan" onClick={() => set({ expires: "" })}>Never end</button>}
            </div>
          </>
        )}

        <label className="flex min-h-[44px] items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[#2b37f0]" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
          Code is on
        </label>

        <button type="submit" className="btn btn-blue" disabled={!dirty || busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dirty ? "Save changes" : "Saved"}
        </button>
      </form>

      {warn && (
        <LabelWarning
          warning={warn} busy={warnBusy}
          onReprint={() => { setWarnBusy("reprint"); void persist(true); }}
          onSave={() => { setWarnBusy("save"); void persist(false); }}
          onCancel={() => setWarn(null)}
        />
      )}

      <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="dl-h">
        <h2 id="dl-h" className="t-card">The code</h2>
        <div className="mx-auto w-full max-w-[220px] rounded-[4px] p-3 shadow-[0_2px_0_var(--af-line)]" style={{ background: look.bg }} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="flex flex-wrap gap-2">
          {initial.artworkId && (
            <Link href={`/studio/qr?code=${initial.code}`} className="btn btn-ghost btn-sm"><Pencil className="h-4 w-4" aria-hidden="true" />Card in QR Studio</Link>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" }), `artfinity-${initial.code}.svg`)}>
            <Download className="h-4 w-4" aria-hidden="true" />SVG
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => png().then(() => saved("Code PNG downloaded")).catch(() => failed("The PNG didn't download. Try again.", { retry: () => { void png(); } }))}>
            <ImageIcon className="h-4 w-4" aria-hidden="true" />PNG
          </button>
        </div>
      </section>
    </div>
  );
}
