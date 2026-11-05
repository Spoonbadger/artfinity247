"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cantReason } from "@/lib/adminCaps";
import { useAdminCan } from "../../_components/AdminRole";

export type VenueFormValue = {
  id?: string;
  name: string;
  neighborhood: string;
  address: string;
  contactName: string;
  contactEmail: string;
  /** Percent of Artfinity's profit, e.g. 5 */
  sharePct: number;
  active: boolean;
  notes: string;
};

const EMPTY: VenueFormValue = { name: "", neighborhood: "", address: "", contactName: "", contactEmail: "", sharePct: 0, active: true, notes: "" };
const input = "min-h-[42px] rounded-lg border-[1.5px] border-line bg-white px-3 text-[15px] font-normal text-ink focus:border-ink";

/** Add or edit a partner venue. The share field needs the money role (owner/admin); the API checks again. */
export default function VenueForm({ initial, onDone }: { initial?: VenueFormValue; onDone?: () => void }) {
  const router = useRouter();
  const canEdit = useAdminCan("accounts");
  const canMoney = useAdminCan("money");
  const [f, setF] = useState<VenueFormValue>(initial ?? EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<VenueFormValue>) => setF((o) => ({ ...o, ...p }));
  const editing = !!initial?.id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setErr("Give the venue a name.");
    setBusy(true);
    setErr(null);
    try {
      const { id: _id, ...body } = f;
      if (!canMoney) delete (body as Partial<VenueFormValue>).sharePct;
      const r = await fetch(editing ? `/api/admin/venues/${initial!.id}` : "/api/admin/venues", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't save.");
      toast.success(d.message || "Saved");
      if (!editing) setF(EMPTY);
      onDone?.();
      router.refresh();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3" noValidate>
      <fieldset disabled={!canEdit || busy} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-[13px] font-semibold">
          Name
          <input className={input} value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} required placeholder="Kalimera Coffee" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          Neighborhood
          <input className={input} value={f.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} maxLength={60} placeholder="Williamsburg" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold sm:col-span-2">
          Address
          <input className={input} value={f.address} onChange={(e) => set({ address: e.target.value })} maxLength={160} placeholder="123 Bedford Ave, Brooklyn, NY 11211" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          Contact name
          <input className={input} value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} maxLength={80} />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          Contact email
          <input className={input} type="email" value={f.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} maxLength={120} placeholder="owner@cafe.com" />
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          Share of Artfinity&apos;s profit (%)
          <input
            className={input} type="number" min={0} max={50} step={0.5} inputMode="decimal" value={Number.isFinite(f.sharePct) ? f.sharePct : 0}
            disabled={!canMoney} title={!canMoney ? cantReason("money") : undefined}
            onChange={(e) => set({ sharePct: e.target.value === "" ? 0 : Number(e.target.value) })}
          />
          <span className="text-[12px] font-normal text-ink-2">0 = recognition only. Applies to sales from codes hanging here.</span>
        </label>
        <label className="flex min-h-[42px] items-center gap-2.5 self-end text-[14.5px] font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[#2b37f0]" checked={f.active} onChange={(e) => set({ active: e.target.checked })} />
          Active (listed publicly and in the artists&apos; picker)
        </label>
        <label className="grid gap-1 text-[13px] font-semibold sm:col-span-2">
          Notes
          <textarea className="rounded-lg border-[1.5px] border-line px-3 py-2 text-[15px] font-normal text-ink focus:border-ink" rows={3} maxLength={2000} value={f.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Wall by the window holds 4 pieces. Owner prefers email." />
        </label>
      </fieldset>
      {err && <p role="alert" className="text-[13.5px] font-semibold text-coral">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn btn-blue btn-sm" disabled={!canEdit || busy}>{busy ? "Saving…" : editing ? "Save venue" : "Add venue"}</button>
        {!canEdit && <span className="text-[12px] text-ink-2">{cantReason("accounts")}</span>}
      </div>
    </form>
  );
}
