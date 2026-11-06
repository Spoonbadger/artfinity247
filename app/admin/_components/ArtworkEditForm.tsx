"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saved as savedToast } from "@/lib/feedback";
import { Check, Loader2 } from "lucide-react";
import { basePrices } from "@/lib/artwork_price";
import { SENSITIVE_LABELS } from "@/components/studio/sensitive";
import { cn } from "@/lib/utils";

type Status = "PENDING" | "APPROVED" | "REJECTED";
type MarkupKey = "markupSmall" | "markupMedium" | "markupLarge" | "markupXl";
export type AdminArtwork = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  status: Status;
  sensitive: string[];
} & Record<MarkupKey, number>;

const SIZES: { key: MarkupKey; base: keyof typeof basePrices; label: string }[] = [
  { key: "markupSmall", base: "small", label: "Small 5×7" },
  { key: "markupMedium", base: "medium", label: "Medium 8×12" },
  { key: "markupLarge", base: "large", label: "Large 11×17" },
  { key: "markupXl", base: "xl", label: "XL 18×24" },
];
const STATUSES: { v: Status; label: string }[] = [
  { v: "PENDING", label: "Waiting" },
  { v: "APPROVED", label: "Live" },
  { v: "REJECTED", label: "Rejected" },
];

const toDollars = (c: number) => (c / 100).toFixed(2);

export default function ArtworkEditForm({ artwork }: { artwork: AdminArtwork }) {
  const router = useRouter();
  const [saved, setSaved] = useState(artwork);
  const [title, setTitle] = useState(artwork.title);
  const [description, setDescription] = useState(artwork.description);
  const [status, setStatus] = useState<Status>(artwork.status);
  const [labels, setLabels] = useState<string[]>(artwork.sensitive);
  const [markups, setMarkups] = useState<Record<MarkupKey, string>>(() =>
    Object.fromEntries(SIZES.map((s) => [s.key, toDollars(artwork[s.key])])) as Record<MarkupKey, string>
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extraLabels = labels.filter((l) => !(SENSITIVE_LABELS as readonly string[]).includes(l));

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Title can't be empty.");
    const body: Record<string, unknown> = {};
    if (title.trim() !== saved.title) body.title = title.trim();
    if (description.trim() !== saved.description) body.description = description.trim();
    if (status !== saved.status) body.status = status;
    if ([...labels].sort().join("|") !== [...saved.sensitive].sort().join("|")) body.sensitive = labels;
    for (const s of SIZES) {
      const n = Number(markups[s.key]);
      if (!Number.isFinite(n) || n < 0) return setError(`${s.label}: enter a dollar amount of 0 or more.`);
      const cents = Math.round(n * 100);
      if (cents !== saved[s.key]) body[s.key] = cents;
    }
    if (!Object.keys(body).length) return toast("No changes");
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/artworks/${artwork.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Could not save.");
      const a = d.artwork;
      const next: AdminArtwork = {
        ...saved,
        title: a.title,
        description: a.description,
        status: a.status,
        sensitive: a.sensitive,
        markupSmall: a.markupSmall ?? 0,
        markupMedium: a.markupMedium ?? 0,
        markupLarge: a.markupLarge ?? 0,
        markupXl: a.markupXl ?? 0,
      };
      setSaved(next);
      setLabels(next.sensitive);
      setMarkups(Object.fromEntries(SIZES.map((s) => [s.key, toDollars(next[s.key])])) as Record<MarkupKey, string>);
      savedToast("Saved", { next: { label: "Back to moderation", href: "/admin/moderation" } });
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  const toggle = (l: string) => setLabels((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));

  return (
    <form onSubmit={save} className="grid items-start gap-6 rounded-2xl border border-edge bg-white p-4 sm:p-6 lg:grid-cols-[280px_minmax(0,1fr)]" noValidate>
      <div className="overflow-hidden rounded-[4px] bg-gallery">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artwork.imageUrl} alt={saved.title} className="max-h-[360px] w-full object-contain" />
      </div>

      <div className="grid gap-5">
        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[14px] font-bold">Status</legend>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <label key={s.v} className={cn("cursor-pointer rounded-full border-[1.5px] px-3.5 py-1.5 text-[14px] font-semibold focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-scan", status === s.v ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                <input type="radio" name="status" value={s.v} checked={status === s.v} onChange={() => setStatus(s.v)} className="sr-only" />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="af-field">
          <span className="label">Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
        </label>
        <label className="af-field">
          <span className="label">Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} className="resize-y" />
        </label>



        <fieldset className="grid gap-2">
          <legend className="mb-2 text-[14px] font-bold">Sensitive labels</legend>
          <div className="flex flex-wrap gap-2">
            {[...SENSITIVE_LABELS, ...extraLabels].map((l) => (
              <label key={l} className={cn("flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-3 py-1.5 text-[13.5px] font-semibold", labels.includes(l) ? "border-coral bg-coral/10 text-coral" : "border-line bg-white")}>
                <input type="checkbox" checked={labels.includes(l)} onChange={() => toggle(l)} className="h-4 w-4 accent-[var(--af-coral)]" />
                {l}
              </label>
            ))}
          </div>
        </fieldset>

        <details className="grid gap-2">
          <summary className="cursor-pointer text-[14px] font-bold">Prices <span className="font-normal text-ink-2">· markup on top of the base print price</span></summary>
          <fieldset className="mt-2">
          <legend className="sr-only">Markup per size, in dollars</legend>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SIZES.map((s) => {
              const n = Number(markups[s.key]);
              const price = Number.isFinite(n) && n >= 0 ? (basePrices[s.base] + Math.round(n * 100)) / 100 : null;
              return (
                <label key={s.key} className="af-field">
                  <span className="label">{s.label}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={markups[s.key]}
                    onChange={(e) => setMarkups((x) => ({ ...x, [s.key]: e.target.value }))}
                    aria-describedby={`${s.key}-price`}
                    className="num"
                  />
                  <span id={`${s.key}-price`} className="num t-small">{price !== null ? `Sells at $${price.toFixed(2)}` : "Check the amount"}</span>
                </label>
              );
            })}
          </div>
          </fieldset>
        </details>
        {error && <p role="alert" className="rounded-xl border-2 border-coral bg-[#fff1ed] px-3.5 py-2.5 text-[14px] font-semibold">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-blue" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}Save changes
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => router.back()}>Back</button>
        </div>
      </div>
    </form>
  );
}
