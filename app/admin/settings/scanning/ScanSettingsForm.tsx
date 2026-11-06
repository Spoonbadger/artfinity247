"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAdminCan } from "../../_components/AdminRole";
import { DEFAULT_CARE_TEXT, type ScanBand, type ScanField, type ScanSettings } from "@/lib/scanning";

const dollars = (c: number | null) => (c == null ? "" : String(c / 100));
const toCents = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

type V = {
  enabled: boolean;
  bands: { key: ScanBand["key"]; label: string; maxShort: string; maxLong: string; price: string }[];
  pickupFee: string;
  turnaroundDays: string;
  returnDays: string;
  dropoffAddress: string;
  careText: string;
};

const fromSettings = (s: ScanSettings): V => ({
  enabled: s.enabled,
  bands: s.bands.map((b) => ({ key: b.key, label: b.label, maxShort: String(b.maxShort), maxLong: String(b.maxLong), price: dollars(b.priceCents) })),
  pickupFee: dollars(s.pickupFeeCents),
  turnaroundDays: String(s.turnaroundDays),
  returnDays: String(s.returnDays),
  dropoffAddress: s.dropoffAddress,
  careText: s.careText,
});

const input = "min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] font-normal text-ink focus:border-ink";

/** The scanning service's settings. Placeholder fields carry a "set by Craig" badge and a "confirm as is" box. */
export default function ScanSettingsForm({ value }: { value: ScanSettings }) {
  const router = useRouter();
  const canEdit = useAdminCan("settings");
  const start = fromSettings(value);
  const [v, setV] = useState<V>(start);
  const [confirm, setConfirm] = useState<Set<ScanField>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const placeholder = (f: ScanField) => value.placeholders.includes(f);

  const changed = {
    enabled: v.enabled !== start.enabled,
    prices: JSON.stringify(v.bands) !== JSON.stringify(start.bands),
    pickupFee: v.pickupFee !== start.pickupFee,
    turnaroundDays: v.turnaroundDays !== start.turnaroundDays,
    returnDays: v.returnDays !== start.returnDays,
    dropoffAddress: v.dropoffAddress !== start.dropoffAddress,
    careText: v.careText !== start.careText,
  };
  const dirty = Object.values(changed).some(Boolean) || confirm.size > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const body: Record<string, unknown> = {};
    const conf = new Set(confirm);
    if (changed.enabled) body.enabled = v.enabled;
    if (changed.prices || conf.has("prices")) {
      body.bands = v.bands.map((b) => ({ key: b.key, label: b.label, maxShort: Number(b.maxShort), maxLong: Number(b.maxLong), priceCents: toCents(b.price) }));
      if (changed.prices && v.bands.some((b) => b.price.trim())) conf.add("prices");
    }
    if (changed.pickupFee || conf.has("pickupFee")) { body.pickupFeeCents = toCents(v.pickupFee); conf.add("pickupFee"); }
    for (const k of ["turnaroundDays", "returnDays"] as const) if (changed[k] || conf.has(k)) { body[k] = Number(v[k]); conf.add(k); }
    for (const k of ["dropoffAddress", "careText"] as const) if (changed[k] || conf.has(k)) { body[k] = v[k]; if (v[k].trim()) conf.add(k); }
    body.confirm = Array.from(conf);
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings/scanning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      toast.success(changed.enabled ? `Scanning service ${v.enabled ? "on" : "off"}` : "Scanning settings saved");
      setConfirm(new Set());
      router.refresh();
    } catch (e2) {
      const m = (e2 as Error).message;
      setErr(m);
      toast.error(m);
    } finally {
      setBusy(false);
    }
  }

  const mark = (f: ScanField) =>
    placeholder(f) && !changed[f] ? (
      <span className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-sticker px-2 py-0.5 text-[11.5px] font-bold text-ink">Placeholder · set by Craig</span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[13px] font-semibold text-ink-2">
          <input type="checkbox" checked={confirm.has(f)} onChange={(e) => setConfirm((c) => { const n = new Set(c); if (e.target.checked) n.add(f); else n.delete(f); return n; })} className="h-4 w-4 accent-[rgb(var(--af-scan-rgb))]" />
          Confirm as is
        </label>
      </span>
    ) : null;

  return (
    <form onSubmit={save} className="grid gap-4" noValidate>
      <Section title="Service">
        {value.enabledSource === "env" ? (
          <p className="rounded-xl bg-wall p-3 text-[14px]">Set by the environment: <b>{value.enabled ? "on" : "off"}</b>. Change SCANNING_SERVICE there.</p>
        ) : (
          <label className="flex cursor-pointer items-start gap-2.5 text-[15px] font-semibold">
            <input type="checkbox" checked={v.enabled} onChange={(e) => setV({ ...v, enabled: e.target.checked })} className="mt-0.5 h-[18px] w-[18px] accent-[rgb(var(--af-scan-rgb))]" />
            <span>
              Scanning service on
              <span className="block text-[13px] font-normal text-ink-2">
                Off: /scanning and the Studio show &ldquo;Coming soon — join the waitlist&rdquo;. {value.enabledSource === "default" ? "Not set yet, so it's on in development and off in production." : ""}
              </span>
            </span>
          </label>
        )}
      </Section>

      <Section title="Prices by painting size" mark={mark("prices")}>
        <p className="text-[13px] text-ink-2">Per painting. A painting fits a band when its short side and long side both fit. Leave a price empty to show &ldquo;Ask for a quote&rdquo;. Bigger than the last band is always quoted.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-[13px]">
            <thead className="text-ink-2"><tr><th className="pb-1 font-semibold">Name</th><th className="pb-1 font-semibold">Up to (in)</th><th className="pb-1 font-semibold">Price ($)</th></tr></thead>
            <tbody>
              {v.bands.map((b, i) => {
                const set = (p: Partial<V["bands"][number]>) => setV({ ...v, bands: v.bands.map((x, j) => (j === i ? { ...x, ...p } : x)) });
                return (
                  <tr key={b.key}>
                    <td className="py-1 pr-2"><input aria-label={`Band ${i + 1} name`} value={b.label} maxLength={24} onChange={(e) => set({ label: e.target.value })} className={`${input} w-32`} /></td>
                    <td className="py-1 pr-2">
                      <span className="flex items-center gap-1">
                        <input aria-label={`${b.label} short side, inches`} inputMode="numeric" value={b.maxShort} onChange={(e) => set({ maxShort: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={`${input} w-16`} />
                        ×
                        <input aria-label={`${b.label} long side, inches`} inputMode="numeric" value={b.maxLong} onChange={(e) => set({ maxLong: e.target.value.replace(/\D/g, "").slice(0, 3) })} className={`${input} w-16`} />
                      </span>
                    </td>
                    <td className="py-1"><input aria-label={`${b.label} price, dollars`} inputMode="decimal" placeholder="Quote" value={b.price} onChange={(e) => set({ price: e.target.value.replace(/[^0-9.]/g, "").slice(0, 8) })} className={`${input} w-28`} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="NYC pickup fee" mark={mark("pickupFee")}>
        <label className="grid gap-1 text-[13px] font-semibold">
          Per booking, in dollars. Empty = quoted when you confirm; 0 = free.
          <input inputMode="decimal" placeholder="Quoted" value={v.pickupFee} onChange={(e) => setV({ ...v, pickupFee: e.target.value.replace(/[^0-9.]/g, "").slice(0, 8) })} className={`${input} w-32`} />
        </label>
      </Section>

      <Section title="Turnaround">
        <div className="flex flex-wrap gap-6">
          <label className="grid gap-1 text-[13px] font-semibold">
            Files on artworks within (days)
            <input type="number" min={1} max={120} value={v.turnaroundDays} onChange={(e) => setV({ ...v, turnaroundDays: e.target.value })} className={`${input} w-24`} />
            {mark("turnaroundDays")}
          </label>
          <label className="grid gap-1 text-[13px] font-semibold">
            Paintings returned within (days)
            <input type="number" min={1} max={120} value={v.returnDays} onChange={(e) => setV({ ...v, returnDays: e.target.value })} className={`${input} w-24`} />
            {mark("returnDays")}
          </label>
        </div>
      </Section>

      <Section title="Drop-off address and instructions" mark={mark("dropoffAddress")}>
        <p className="text-[13px] text-ink-2">Never shown publicly. It fills in when you confirm a drop-off booking, and goes to the artist in the confirmation email and their Studio.</p>
        <textarea rows={3} maxLength={600} value={v.dropoffAddress} onChange={(e) => setV({ ...v, dropoffAddress: e.target.value })} placeholder="Street, unit, buzzer, hours, who to ask for" className={`${input} py-2`} aria-label="Drop-off address and instructions" />
      </Section>

      <Section title="Care wording" mark={mark("careText")}>
        <p className="text-[13px] text-ink-2">Shown on /scanning and in the Studio. {"{returnDays}"} becomes the return days. Don&apos;t promise insurance terms you haven&apos;t confirmed.</p>
        <textarea rows={4} maxLength={800} value={v.careText} onChange={(e) => setV({ ...v, careText: e.target.value })} className={`${input} py-2`} aria-label="Care wording" />
        {v.careText !== DEFAULT_CARE_TEXT && <button type="button" onClick={() => setV({ ...v, careText: DEFAULT_CARE_TEXT })} className="justify-self-start text-[13px] font-semibold text-scan">Reset to the default wording</button>}
      </Section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white/95 p-3 shadow-sm backdrop-blur">
        <button type="submit" disabled={busy || !dirty || !canEdit} title={canEdit ? undefined : "Only an owner can change settings."} className="btn btn-blue btn-sm">{busy ? "Saving…" : "Save"}</button>
        <span className="text-[13px] text-ink-2">{dirty ? "Unsaved changes." : value.placeholders.length ? `${value.placeholders.length} still placeholders.` : "All set."}</span>
        {err && <span role="alert" className="text-[13px] font-semibold text-coral">{err}</span>}
      </div>
    </form>
  );
}

function Section({ title, mark, children }: { title: string; mark?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-2.5 rounded-2xl border border-line bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-card">{title}</h2>
        {mark}
      </div>
      {children}
    </section>
  );
}
