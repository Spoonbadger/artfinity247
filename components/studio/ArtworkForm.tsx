"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { breakdown, money, SIZE_INCHES, SIZE_NAME, type SizeKey } from "@/lib/earnings";
import { basePrices } from "@/lib/artwork_price";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { SENSITIVE_LABELS } from "./sensitive";

const SIZES: SizeKey[] = ["small", "medium", "large", "xl"];
const FIELD: Record<SizeKey, "markupSmall" | "markupMedium" | "markupLarge" | "markupXl"> = {
  small: "markupSmall", medium: "markupMedium", large: "markupLarge", xl: "markupXl",
};

export type ArtworkInput = {
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  sensitive: string[];
  markupSmall: number | null;
  markupMedium: number | null;
  markupLarge: number | null;
  markupXl: number | null;
};

// The artist types the full print price. Markup = price - base, and the price can't go below the base.
const priceFor = (size: SizeKey, markup: number | null | undefined) => ((basePrices[size] + Math.max(0, markup || 0)) / 100).toFixed(2);
const toCents = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.min(200000, Math.max(0, Math.round(n * 100))) : 0;
};

export default function ArtworkForm({ artwork }: { artwork?: ArtworkInput }) {
  const router = useRouter();
  const editing = !!artwork;
  const fileRef = useRef<HTMLInputElement>(null);

  const [imageUrl, setImageUrl] = useState(artwork?.imageUrl || "");
  const [printable, setPrintable] = useState<SizeKey[] | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState(artwork?.title || "");
  const [description, setDescription] = useState(artwork?.description || "");
  const [prices, setPrices] = useState<Record<SizeKey, string>>({
    small: priceFor("small", artwork?.markupSmall), medium: priceFor("medium", artwork?.markupMedium),
    large: priceFor("large", artwork?.markupLarge), xl: priceFor("xl", artwork?.markupXl),
  });
  const [sensitive, setSensitive] = useState<string[]>(artwork?.sensitive || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ slug: string; title: string; imageUrl: string } | null>(null);

  // New pieces start from the artist's last prices.
  useEffect(() => {
    if (editing) return;
    fetch("/api/artworks/last-prices", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setPrices({ small: priceFor("small", p.markupSmall), medium: priceFor("medium", p.markupMedium), large: priceFor("large", p.markupLarge), xl: priceFor("xl", p.markupXl) });
      })
      .catch(() => {});
  }, [editing]);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) { setError("Pick an image file: JPG, PNG, WEBP or HEIC."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Try again.");
      setImageUrl(data.url);
      setPrintable(data.printable || []);
      setDims(data.width ? { w: data.width, h: data.height } : null);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80));
    } catch (e: any) {
      setError(e.message || "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) upload(f);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!imageUrl) { setError("Add an image first."); return; }
    if (!title.trim()) { setError("Give it a title."); return; }
    const low = SIZES.find((s) => toCents(prices[s]) < basePrices[s]);
    if (low) { setError(`${SIZE_NAME[low]} prints start at ${money(basePrices[low])}.`); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", description.trim());
      fd.append("imageUrl", imageUrl);
      for (const s of SIZES) fd.append(FIELD[s], String(Math.max(0, toCents(prices[s]) - basePrices[s])));
      fd.append("sensitive", sensitive.join(","));
      if (printable) fd.append("printable", printable.join(","));
      const res = await fetch(editing ? `/api/artworks/update/${artwork!.slug}` : "/api/artworks/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error((await res.text()) || "Could not save. Try again.");
      const saved = await res.json();
      if (editing) {
        toast.success("Saved");
        router.push("/studio/art");
        router.refresh();
      } else {
        setDone({ slug: saved.slug, title: saved.title, imageUrl: saved.imageUrl });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e: any) {
      setError(e.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="af-card mx-auto grid max-w-[640px] gap-5 p-5 text-center sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={done.imageUrl} alt={done.title} className="mx-auto max-h-[340px] w-auto rounded-[3px] shadow-[0_10px_30px_rgba(21,22,27,.18)]" />
        <div>
          <h2 className="display text-[40px]">It&apos;s live.</h2>
          <p className="mt-2 text-ink-2">{done.title} is on your page. Next: hang its code.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/studio/qr?art=${done.slug}`} className="btn btn-blue">Print its code</Link>
          <Link href={`/art/${done.slug}`} className="btn btn-ghost">View</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setDone(null); setImageUrl(""); setPrintable(null); setDims(null); setTitle(""); setDescription(""); setSensitive([]); }}>
            Upload another
          </button>
        </div>
      </div>
    );
  }

  const ready = (s: SizeKey) => !printable || printable.includes(s);

  return (
    <form onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10" noValidate>
      {/* Image */}
      <div className="grid gap-3 lg:sticky lg:top-6">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "relative grid min-h-[300px] cursor-pointer place-items-center overflow-hidden rounded-[4px] border-2 border-dashed bg-wall p-4 text-center transition sm:min-h-[380px]",
            dragging ? "border-scan bg-scan-soft" : imageUrl ? "border-transparent bg-gallery" : "border-ink/30 hover:border-ink"
          )}
        >
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} aria-label={imageUrl ? "Replace image" : "Choose an image"} />
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={title || "Your artwork"} className="max-h-[520px] w-auto max-w-full rounded-[2px] shadow-[0_12px_30px_rgba(21,22,27,.22)]" />
          ) : (
            <span className="grid justify-items-center gap-3">
              <span className="relative grid h-16 w-16 place-items-center">
                <i className="paint-dab absolute inset-0 h-16 w-16 opacity-90" style={{ ["--dab" as string]: "#ffd43b" }} />
                <ImagePlus className="relative h-7 w-7" aria-hidden="true" />
              </span>
              <b className="font-display text-[22px] [font-variation-settings:'wdth'_80]">Drop your art here</b>
              <span className="text-[13.5px] text-ink-2">or tap to pick a file · JPG, PNG, HEIC · up to 25 MB</span>
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-white/80 text-[15px] font-bold">
              <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />Uploading</span>
            </span>
          )}
        </label>
        {imageUrl && (
          <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-sm justify-self-start">Replace image</button>
        )}
        {printable && (
          <div className="grid gap-2" aria-live="polite">
            <p className="text-[13px] font-semibold">
              Print-ready sizes{dims ? <span className="num font-normal text-ink-2"> · {dims.w} × {dims.h} px</span> : null}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {SIZES.map((s) => (
                <li key={s} className={cn("flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12.5px] font-semibold", ready(s) ? "border-ink bg-white" : "border-line text-ink-2 line-through")}>
                  {ready(s) && <Check className="h-3.5 w-3.5 text-earned" aria-hidden="true" />}
                  {SIZE_NAME[s]} <span className="font-normal">{SIZE_INCHES[s]}</span>
                  <span className="sr-only">{ready(s) ? "ready" : "needs a bigger file"}</span>
                </li>
              ))}
            </ul>
            {printable.length < SIZES.length && <p className="text-[12.5px] text-ink-2">Bigger file, bigger prints.</p>}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="grid gap-6">
        <div className="grid gap-3">
          <label className="af-field">
            <span className="label">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required placeholder="Name of the piece" />
          </label>
          <label className="af-field">
            <span className="label">A line about it <span className="text-ink-2">(optional)</span></span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1200} placeholder="Medium, place, a story. Short is fine." className="resize-y" />
          </label>
        </div>

        <fieldset className="grid gap-3">
          <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
            <span className="font-display text-[22px] font-bold [font-variation-settings:'wdth'_80]">Prices</span>
            <span className="text-[12.5px] text-ink-2">Set your price. We print and ship.</span>
          </legend>
          <ul className="grid gap-2">
            {SIZES.map((s) => {
              const cents = toCents(prices[s]);
              const tooLow = cents < basePrices[s];
              const b = breakdown(s, Math.max(0, cents - basePrices[s]));
              return (
                <li key={s} className={cn("grid grid-cols-[minmax(0,1fr)_118px] items-center gap-x-3 gap-y-1 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)]", tooLow ? "border-coral" : "border-line", !ready(s) && "opacity-60")}>
                  <div className="min-w-0">
                    <b className="block text-[15px]">{SIZE_NAME[s]} <span className="font-normal text-ink-2">{SIZE_INCHES[s]}</span></b>
                    <span className="num text-[13px] text-ink-2">Min {money(basePrices[s])}</span>
                  </div>
                  <label className="flex items-center gap-1 rounded-lg border-2 border-ink px-2 py-1 focus-within:border-scan">
                    <span className="text-[14px] text-ink-2">$</span>
                    <input
                      inputMode="decimal" value={prices[s]} aria-label={`${SIZE_NAME[s]} print price in dollars`} aria-invalid={tooLow || undefined}
                      onChange={(e) => setPrices((m) => ({ ...m, [s]: e.target.value.replace(/[^0-9.]/g, "").slice(0, 7) }))}
                      onBlur={() => setPrices((m) => ({ ...m, [s]: (toCents(m[s]) / 100).toFixed(2) }))}
                      className="num w-full min-w-0 bg-transparent text-[16px] font-semibold outline-none"
                    />
                  </label>
                  <p className="col-span-2 text-[13.5px] sm:col-span-1 sm:text-right" aria-live="polite">
                    {tooLow
                      ? <span className="font-semibold text-coral">At least {money(basePrices[s])}</span>
                      : <>you earn <b className="num text-[16px] text-earned">{money(b.artist)}</b> per print</>}
                  </p>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1">
            <span className="font-display text-[22px] font-bold [font-variation-settings:'wdth'_80]">Sensitive?</span>
            <span className="ml-2 text-[12.5px] text-ink-2">Buyers see it blurred until they tap.</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {SENSITIVE_LABELS.map((l) => {
              const on = sensitive.includes(l);
              return (
                <label key={l} className={cn("flex cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-2 text-[14px] font-semibold transition focus-within:ring-[3px] focus-within:ring-scan/40", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => setSensitive((cur) => (on ? cur.filter((x) => x !== l) : [...cur, l]))} />
                  <span aria-hidden="true" className={cn("grid h-4 w-4 place-items-center rounded-[4px] border-2", on ? "border-sticker bg-sticker text-ink" : "border-ink/40")}>{on && <Check className="h-3 w-3" />}</span>
                  {l}
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && <p role="alert" className="rounded-xl border-2 border-coral bg-[#fff1ed] px-3.5 py-2.5 text-[14px] font-semibold">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-blue btn-lg relative z-0" disabled={saving || uploading}>
            {saving && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {editing ? "Save changes" : "Put it on my page"}
          </button>
          <Link href="/studio/art" className="btn btn-ghost">Cancel</Link>
          {!editing && (
            <span className="relative z-0 text-[13px] text-ink-2">
              Free to list. <span className="relative inline-block font-semibold text-ink">You keep 60% of profit<BrushStroke className="absolute -bottom-1 left-0 -z-10 h-2 w-full" /></span>
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
