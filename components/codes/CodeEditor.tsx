"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, ImageIcon, Loader2, Pencil } from "lucide-react";
import { qrSVG, type DotStyle, type EyeStyle } from "@/lib/qr/render";
import { shortUrl } from "@/lib/shortcode";

export type EditableCode = {
  code: string;
  label: string;
  venue: string;
  discountPct: number | null;
  active: boolean;
  expiresAt: string | null; // ISO
  artworkId: string | null;
};
export type CodeArt = { id: string; title: string; imageUrl: string };
export type CodeLook = { fg: string; bg: string; dots: DotStyle; eyes: EyeStyle; eye: string | null; logo: boolean; printedDisc: number; printedVenue: string | null };

const STEPS = [5, 10, 15, 20, 25, 30];
const dayOf = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/** Edit what's behind a printed code, and download the code again. */
export default function CodeEditor({ initial, arts, look, base }: { initial: EditableCode; arts: CodeArt[]; look: CodeLook; base: string }) {
  const router = useRouter();
  const [f, setF] = useState({ ...initial, expires: dayOf(initial.expiresAt) });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((o) => ({ ...o, ...p }));
  const dirty = f.label !== initial.label || f.venue !== initial.venue || f.discountPct !== initial.discountPct || f.active !== initial.active || f.expires !== dayOf(initial.expiresAt) || f.artworkId !== initial.artworkId;
  const art = arts.find((a) => a.id === f.artworkId) || null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch(`/api/qr/codes/${initial.code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: f.label, venue: f.venue, discountPct: f.discountPct, active: f.active, artworkId: f.artworkId,
          expiresAt: f.expires ? new Date(`${f.expires}T23:59:59`).toISOString() : null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Couldn't save. Try again.");
      toast.success("Saved", { description: "The printed code opens the new version now." });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally { setBusy(false); }
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

  const tagWarn = look.printedDisc > 0 && f.discountPct !== look.printedDisc;
  const venueWarn = !!look.printedVenue && f.venue.trim() !== look.printedVenue;

  return (
    <div className="grid content-start gap-4">
      <form onSubmit={save} className="af-card grid gap-4 p-4 sm:p-5" aria-labelledby="edit-h">
        <h2 id="edit-h" className="flex items-center gap-2 text-[20px] font-bold">
          <span className="paint-dab h-3 w-5" style={{ ["--dab" as string]: "#ffd43b" }} aria-hidden="true" />Behind the code
        </h2>

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
          <div className="flex items-center gap-3 text-[13px] text-ink-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art.imageUrl} alt={art.title} className="h-12 w-12 rounded-[3px] object-cover" />
            Scans land on {art.title}.
          </div>
        )}

        <label className="af-field">
          <span className="label">Venue</span>
          <input type="text" maxLength={60} value={f.venue} onChange={(e) => set({ venue: e.target.value })} placeholder="River Arts Market" />
        </label>
        {venueWarn && <p className="-mt-2 text-[12.5px] text-ink-2">The card itself still says {look.printedVenue}.</p>}

        <label className="af-field">
          <span className="label">Discount</span>
          <select value={f.discountPct ?? 0} onChange={(e) => set({ discountPct: +e.target.value || null })}>
            <option value={0}>No discount</option>
            {STEPS.map((v) => <option key={v} value={v}>{v}% off</option>)}
          </select>
        </label>
        {tagWarn && <p className="-mt-2 text-[12.5px] text-ink-2">The printed tag still says {look.printedDisc}% off. Buyers get {f.discountPct ? `${f.discountPct}%` : "full price"}.</p>}

        <label className="af-field">
          <span className="label">Stops working after</span>
          <input type="date" value={f.expires} onChange={(e) => set({ expires: e.target.value })} />
        </label>
        <div className="-mt-2 flex items-center justify-between gap-2 text-[12.5px] text-ink-2">
          <span>{f.expires ? "Then it opens your page with a short note." : "Never ends."}</span>
          {f.expires && <button type="button" className="font-bold text-scan" onClick={() => set({ expires: "" })}>Never end</button>}
        </div>

        <label className="flex min-h-[44px] items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[#2b37f0]" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
          Code is on
        </label>

        <button type="submit" className="btn btn-blue" disabled={!dirty || busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{dirty ? "Save changes" : "Saved"}
        </button>
      </form>

      <section className="af-card grid gap-3 p-4 sm:p-5" aria-labelledby="dl-h">
        <h2 id="dl-h" className="flex items-center gap-2 text-[20px] font-bold">
          <span className="paint-dab h-3 w-5" style={{ ["--dab" as string]: "#2b37f0" }} aria-hidden="true" />The code
        </h2>
        <div className="mx-auto w-full max-w-[220px] rounded-[4px] p-3 shadow-[0_2px_0_var(--af-line)]" style={{ background: look.bg }} dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="flex flex-wrap gap-2">
          {initial.artworkId && (
            <Link href={`/studio/qr?code=${initial.code}`} className="btn btn-ghost btn-sm"><Pencil className="h-4 w-4" aria-hidden="true" />Card in QR Studio</Link>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => saveBlob(new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${svg}`], { type: "image/svg+xml" }), `artfinity-${initial.code}.svg`)}>
            <Download className="h-4 w-4" aria-hidden="true" />SVG
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => png().catch(() => toast.error("The PNG didn't download. Try again."))}>
            <ImageIcon className="h-4 w-4" aria-hidden="true" />PNG
          </button>
        </div>
      </section>
    </div>
  );
}
