"use client";
// The upload form's pieces, shared by the single form (ArtworkForm) and the upload queue (UploadQueue):
// print-size crop cards, title/description/original size, prices with "you earn" and price guidance,
// print run, sensitive labels and the ownership box, plus the checks and the form data both send.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { breakdown, money, SIZE_INCHES, SIZE_NAME, type SizeKey } from "@/lib/earnings";
import { basePrices } from "@/lib/artwork_price";
import { cn } from "@/lib/utils";
import { SENSITIVE_LABELS } from "./sensitive";
import { EDITION_MAX, EDITION_MIN } from "@/lib/editionFormat";
import { SIZE_IN } from "@/components/art/pricing";
import { PIXELS_NEEDED } from "@/lib/printSizes";
import { joinOriginal } from "@/lib/originalSize";
import type { StoredEdits } from "@/lib/imageEdits";
import { problemFrom } from "@/lib/feedback";
import type { PriceGuide } from "@/app/api/artworks/price-guide/route";
import { cleanMoney } from "@/lib/smartFields";
import { PAINTING_SCANS } from "@/lib/features";

export const SIZES: SizeKey[] = ["small", "medium", "large", "xl"];
export const FIELD: Record<SizeKey, "markupSmall" | "markupMedium" | "markupLarge" | "markupXl"> = {
  small: "markupSmall", medium: "markupMedium", large: "markupLarge", xl: "markupXl",
};
export const REVIEW_NOTE = "In review — usually within a day";
export const TOO_SMALL = "This file is too small to print well. Try the original photo or a bigger scan.";

export type Prices = Record<SizeKey, string>;
type Markups = { markupSmall?: number | null; markupMedium?: number | null; markupLarge?: number | null; markupXl?: number | null };

// The artist types the full print price. Markup = price - base, and the price can't go below the base.
export const priceFor = (size: SizeKey, markup: number | null | undefined) => ((basePrices[size] + Math.max(0, markup || 0)) / 100).toFixed(2);
export const toCents = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.min(200000, Math.max(0, Math.round(n * 100))) : 0;
};
export const pricesFrom = (m?: Markups | null): Prices => ({
  small: priceFor("small", m?.markupSmall), medium: priceFor("medium", m?.markupMedium),
  large: priceFor("large", m?.markupLarge), xl: priceFor("xl", m?.markupXl),
});

/** "east_river-late.jpg" → "East River Late". */
export const titleFromFile = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80);

/** Images the upload accepts (by type, or by extension when the browser leaves the type empty, e.g. HEIC). */
export const isImageFile = (f: File) => /^image\//.test(f.type) || (!f.type && /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name));

/**
 * Files from a drop: plain files, and the images inside any dropped folder (and its subfolders).
 * Folders need the entries API; browsers without it just give the files.
 */
export async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items || []).map((i) => (i.kind === "file" ? i.webkitGetAsEntry?.() : null));
  if (!entries.some((e) => e?.isDirectory)) return Array.from(dt.files || []);
  const out: File[] = [];
  const walk = async (e: FileSystemEntry): Promise<void> => {
    if (out.length >= 500) return;
    if (e.isFile) {
      out.push(await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej)));
    } else if (e.isDirectory) {
      const reader = (e as FileSystemDirectoryEntry).createReader();
      // readEntries hands back the folder in pages; keep reading until it's empty.
      for (;;) {
        const page = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        if (!page.length) break;
        for (const c of page) await walk(c);
      }
    }
  };
  for (const e of entries) if (e) await walk(e).catch(() => {});
  return out;
}

/** Images first by folder path then name, so a folder keeps the artist's order (01, 02, ...). */
export const sortFiles = (files: File[]) =>
  [...files].sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));

/** The artist's last prices, for new pieces. */
export function useLastPrices(enabled: boolean, apply: (p: Prices) => void) {
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/artworks/last-prices", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && apply(pricesFrom(p)))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/** "Similar work sells at $X–$Y" per size (other artists' approved work; null = too few to say). */
export function usePriceGuide() {
  const [guide, setGuide] = useState<PriceGuide | null>(null);
  useEffect(() => {
    fetch("/api/artworks/price-guide", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => g && setGuide(g))
      .catch(() => {});
  }, []);
  return guide;
}

export type ArtworkValues = {
  title: string;
  description: string;
  origW: string;
  origH: string;
  prices: Prices;
  sensitive: string[];
  limited: boolean;
  edition: string;
};

/** Element ids of the fields, so a failed check can move focus to the field it's about. */
export const FIELD_ID = {
  title: "art-title",
  original: "art-orig-w",
  price: (s: SizeKey) => `art-price-${s}`,
  edition: "art-edition",
  ownership: "art-ownership",
} as const;

export type ArtworkProblem = { message: string; focus?: string };

/** Same checks the server makes, so the artist hears about them before sending. */
export function checkArtwork(
  v: ArtworkValues,
  o: { imageUrl: string; printable: SizeKey[] | null; editionLocked?: boolean; needsOwnership: boolean; owned: boolean },
): ArtworkProblem | null {
  if (!o.imageUrl) return { message: "Add an image first." };
  if (!v.title.trim()) return { message: "Give it a title.", focus: FIELD_ID.title };
  if (o.printable && !o.printable.length) return { message: TOO_SMALL };
  const low = SIZES.find((s) => toCents(v.prices[s]) < basePrices[s]);
  if (low) return { message: `${SIZE_NAME[low]} prints start at ${money(basePrices[low])}.`, focus: FIELD_ID.price(low) };
  const n = parseInt(v.edition, 10);
  if (!o.editionLocked && v.limited && (!Number.isFinite(n) || n < EDITION_MIN || n > EDITION_MAX)) {
    return { message: `An edition is ${EDITION_MIN} to ${EDITION_MAX} prints.`, focus: FIELD_ID.edition };
  }
  const ow = parseFloat(v.origW), oh = parseFloat(v.origH);
  const hasOrig = v.origW.trim() !== "" || v.origH.trim() !== "";
  if (hasOrig && !(ow >= 1 && oh >= 1 && ow <= 600 && oh <= 600)) return { message: "Original size: both sides in inches, or leave it empty.", focus: FIELD_ID.original };
  if (o.needsOwnership && !o.owned) return { message: "Tick the box to confirm it's your original work.", focus: FIELD_ID.ownership };
  return null;
}

/** The fields POST /api/artworks/upload and /api/artworks/update/[slug] read. Call after checkArtwork. */
export function artworkFormData(
  v: ArtworkValues,
  o: {
    imageUrl: string; fresh: { printable: SizeKey[]; sig: string } | null; editionLocked?: boolean; ownership: boolean; batch?: boolean;
    /** Photo edits behind imageUrl (components/media/ImageEditor.tsx). Leave out to keep what's stored; null clears them. */
    edits?: StoredEdits | null;
  },
): FormData {
  const ow = parseFloat(v.origW), oh = parseFloat(v.origH);
  const hasOrig = v.origW.trim() !== "" || v.origH.trim() !== "";
  const fd = new FormData();
  fd.append("title", v.title.trim());
  fd.append("description", joinOriginal(hasOrig ? { w: ow, h: oh } : null, v.description));
  fd.append("imageUrl", o.imageUrl);
  for (const s of SIZES) fd.append(FIELD[s], String(Math.max(0, toCents(v.prices[s]) - basePrices[s])));
  fd.append("sensitive", v.sensitive.join(","));
  if (!o.editionLocked) fd.append("editionSize", v.limited ? String(parseInt(v.edition, 10)) : "");
  if (o.fresh) { fd.append("printable", o.fresh.printable.join(",")); fd.append("printableSig", o.fresh.sig); }
  if (o.ownership) fd.append("ownership", "yes");
  if (o.batch) fd.append("batch", "1");
  if (o.edits !== undefined) fd.append("imageEdits", o.edits ? JSON.stringify(o.edits) : "");
  return fd;
}

/** Message from a failed artwork save (the routes answer { error, code }). */
export async function saveError(res: Response) {
  return (await saveProblem(res)).message;
}

/** A failed artwork save: the message, the server's code and, for known codes, the page that fixes it. */
export async function saveProblem(res: Response) {
  const fallback = res.status === 429 ? "Too many uploads right now. Wait a minute." : "Could not save. Try again.";
  const p = await problemFrom(res, fallback);
  // Bare 5xx bodies ("Internal Server Error") read as ours, not theirs.
  if (res.status >= 500 && !p.code) return { ...p, message: "Could not save. Try again in a moment." };
  return p;
}

/** Per-size crop previews: how each print size trims the picture, and which sizes are too small. */
/** Where an artist books a painting scan, preselecting the piece when it already exists (app/studio/scanning). */
export const scanHref = (slug?: string | null) => (slug ? `/studio/scanning?art=${encodeURIComponent(slug)}` : "/studio/scanning");

export function PrintSizes({ imageUrl, printable, dims, shape, scanSlug }: { imageUrl: string; printable: SizeKey[]; dims: { w: number; h: number } | null; shape: { w: number; h: number } | null; /** Adds "Book a scan" when the file is too small for big prints; the piece's slug once it exists. */ scanSlug?: string | null }) {
  const ready = (s: SizeKey) => printable.includes(s);
  return (
    <div className="grid gap-2" aria-live="polite">
      <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[13px] font-semibold">
        <span>How it prints{dims ? <span className="num font-normal text-ink-2"> · {dims.w} × {dims.h} px</span> : null}</span>
        <Link href="/help/getting-started/file-sizes-print-sharp" target="_blank" className="text-[13px] text-scan underline-offset-2 hover:underline">Which files print sharp?</Link>
      </p>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
        {SIZES.map((s) => {
          const ok = ready(s);
          const [short, long] = SIZE_IN[s];
          const portrait = !shape || shape.h >= shape.w;
          return (
            <li key={s} className={cn("grid content-start gap-2 rounded-xl border bg-white p-2", ok ? "border-line" : "border-coral/50")}>
              <div className="grid h-[104px] place-items-center rounded-lg bg-wall">
                <div
                  className="overflow-hidden rounded-[2px] bg-gallery shadow-[0_4px_12px_rgba(21,22,27,.18)]"
                  style={portrait ? { width: Math.round((88 * short) / long), height: 88 } : { width: 88, height: Math.round((88 * short) / long) }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className={cn("h-full w-full object-cover", !ok && "opacity-40 grayscale")} />
                </div>
              </div>
              <div className="px-0.5 leading-tight">
                <b className="block text-[13.5px]">{SIZE_NAME[s]} <span className="num font-normal text-ink-2">{SIZE_INCHES[s]}</span></b>
                {ok ? (
                  <span className="mt-0.5 flex items-center gap-1 text-[13px] font-semibold text-earned"><Check className="h-3.5 w-3.5" aria-hidden="true" />Sharp</span>
                ) : (
                  <span className="mt-0.5 block text-[13px] font-semibold text-coral">Too small, hidden from buyers</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {printable.length === 0
        ? <p className="t-small font-semibold !text-coral">Too small to print. Try the original photo or a bigger scan.</p>
        : <p className="t-small">{printable.length < SIZES.length && `XL needs ${PIXELS_NEEDED.xl[0].toLocaleString("en-US")} × ${PIXELS_NEEDED.xl[1].toLocaleString("en-US")} px. `}Each crop shows how that size trims the edges.</p>}
      {PAINTING_SCANS && scanSlug !== undefined && !printable.includes("xl") && (
        <p className="t-small">
          Only have phone photos? We scan the original in NYC so every size prints sharp.{" "}
          <Link href={scanHref(scanSlug)} className="font-semibold text-scan underline-offset-2 hover:underline">Book a scan</Link>
        </p>
      )}
    </div>
  );
}

type Setter<T> = (next: T) => void;

/** Title, a line about it, and the original's size. */
export function DetailsFields({ v, set }: { v: Pick<ArtworkValues, "title" | "description" | "origW" | "origH">; set: (patch: Partial<ArtworkValues>) => void }) {
  return (
    <div className="grid gap-3">
      <label className="af-field">
        <span className="label">Title</span>
        <input id={FIELD_ID.title} value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} required placeholder="Name of the piece" />
      </label>
      <label className="af-field">
        <span className="label">A line about it <span className="text-ink-2">(optional)</span></span>
        <textarea value={v.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1200} placeholder="Medium, place, a story. Short is fine." className="resize-y" />
      </label>
      <div className="af-field">
        <span className="label" id="orig-label">Original size <span className="text-ink-2">(optional)</span></span>
        <div className="flex items-center gap-2" role="group" aria-labelledby="orig-label">
          <input id={FIELD_ID.original} inputMode="decimal" value={v.origW} onChange={(e) => set({ origW: e.target.value.replace(/[^0-9.]/g, "").slice(0, 5) })} placeholder="24" aria-label="Original width in inches" className="num !w-[64px] !border-b-2 !border-line text-center focus:!border-scan" />
          <span aria-hidden="true" className="text-ink-2">×</span>
          <input inputMode="decimal" value={v.origH} onChange={(e) => set({ origH: e.target.value.replace(/[^0-9.]/g, "").slice(0, 5) })} placeholder="30" aria-label="Original height in inches" className="num !w-[64px] !border-b-2 !border-line text-center focus:!border-scan" />
          <span className="text-[14px] text-ink-2">in</span>
        </div>
        <span className="t-small">Buyers see which print size is closest to the real thing.</span>
      </div>
    </div>
  );
}

/** One price per size, with what the artist earns per print and what similar work sells at. */
export function PriceFields({ prices, setPrices, ready, split, guide, note }: { prices: Prices; setPrices: (fn: (p: Prices) => Prices) => void; ready: (s: SizeKey) => boolean; split?: number; guide: PriceGuide | null; note?: ReactNode }) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 flex w-full items-baseline justify-between gap-2">
        <span className="t-card">Prices</span>
        <span className="t-small">{note ?? "Set your price. We print and ship."}</span>
      </legend>
      <ul className="grid gap-2">
        {SIZES.map((s) => {
          const cents = toCents(prices[s]);
          const tooLow = cents < basePrices[s];
          const b = breakdown(s, Math.max(0, cents - basePrices[s]), 0, false, new Date(), split);
          return (
            <li key={s} className={cn("grid grid-cols-[minmax(0,1fr)_118px] items-center gap-x-3 gap-y-1 rounded-xl border bg-white p-3 sm:grid-cols-[minmax(0,1fr)_130px_minmax(0,1fr)]", tooLow ? "border-coral" : "border-line", !ready(s) && "opacity-60")}>
              <div className="min-w-0">
                <b className="block text-[15px]">{SIZE_NAME[s]} <span className="font-normal text-ink-2">{SIZE_INCHES[s]}</span></b>
                <span className="t-small num">Min {money(basePrices[s])}</span>
              </div>
              <label className="flex items-center gap-1 rounded-lg border-2 border-ink px-2 py-1 focus-within:border-scan">
                <span className="text-[14px] text-ink-2">$</span>
                <input
                  id={FIELD_ID.price(s)}
                  inputMode="decimal" value={prices[s]} aria-label={`${SIZE_NAME[s]} print price in dollars`} aria-invalid={tooLow || undefined}
                  onChange={(e) => { const v = cleanMoney(e.target.value, 9999); setPrices((m) => ({ ...m, [s]: v })); }}
                  onBlur={() => setPrices((m) => ({ ...m, [s]: (toCents(m[s]) / 100).toFixed(2) }))}
                  className="num w-full min-w-0 bg-transparent text-[16px] font-semibold outline-none"
                />
              </label>
              <p className="col-span-2 text-[13.5px] sm:col-span-1 sm:text-right" aria-live="polite">
                {tooLow
                  ? <span className="font-semibold text-coral">At least {money(basePrices[s])}</span>
                  : <>you earn <b className="num text-[16px] text-earned">{money(b.artist)}</b> per print</>}
              </p>
              {guide?.[s] && (
                <p className="t-small col-span-2 sm:col-span-3">
                  Similar work on Artfinity sells at <b className="num font-semibold text-ink">${guide[s]!.lo / 100}–${guide[s]!.hi / 100}</b>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Open or limited edition. `locked` shows the run read-only (a print has sold). */
export function EditionField({ limited, edition, setLimited, setEdition, locked, note }: {
  limited: boolean; edition: string; setLimited: Setter<boolean>; setEdition: Setter<string>;
  locked?: { editionSize: number | null; sold: number }; note?: ReactNode;
}) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1">
        <span className="t-card">Print run</span>
        {note && <span className="t-small ml-2">{note}</span>}
      </legend>
      {locked ? (
        <div className="flex items-start gap-3 rounded-xl border-2 border-line bg-wall/60 p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-2" aria-hidden="true" />
          <p className="text-[14px] leading-snug text-ink-2">
            <b className="block text-[15px] text-ink">{locked.editionSize ? `Limited edition of ${locked.editionSize}` : "Open edition"}</b>
            Locked: <span className="num">{locked.editionSize ? `${locked.sold} of ${locked.editionSize}` : locked.sold}</span> sold. Editions can&apos;t change once a print sells.
          </p>
        </div>
      ) : (<>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={cn("flex cursor-pointer items-center gap-3 rounded-xl border-2 bg-white p-3 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", !limited ? "border-ink" : "border-line hover:border-ink-2")}>
            <input type="radio" name="edition" className="sr-only" checked={!limited} onChange={() => setLimited(false)} />
            <span aria-hidden="true" className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", !limited ? "border-ink" : "border-ink/40")}>{!limited && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
            <span className="leading-tight"><b className="block text-[15px]">Open edition</b><span className="t-small">Print forever</span></span>
          </label>
          <div className={cn("flex items-center gap-3 rounded-xl border-2 bg-white p-3 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", limited ? "border-ink bg-[#fffbe8]" : "border-line hover:border-ink-2")}>
            <label className="flex cursor-pointer items-center gap-3">
              <input type="radio" name="edition" className="sr-only" checked={limited} onChange={() => setLimited(true)} />
              <span aria-hidden="true" className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", limited ? "border-ink" : "border-ink/40")}>{limited && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
              <b className="text-[15px] leading-tight">Limited edition of</b>
            </label>
            <input
              id={FIELD_ID.edition}
              type="number" inputMode="numeric" min={EDITION_MIN} max={EDITION_MAX} step={1}
              value={edition} aria-label="Number of prints in the edition"
              onFocus={() => setLimited(true)}
              onChange={(e) => { setLimited(true); setEdition(e.target.value.replace(/[^0-9]/g, "").slice(0, 3)); }}
              className="num w-[76px] rounded-lg border-2 border-ink px-2 py-1 text-[16px] font-semibold outline-none focus:border-scan"
            />
          </div>
        </div>
        {limited && <p className="t-small">Numbered 1 to {parseInt(edition, 10) || "N"}, all sizes. Then sold out. Locked once the first print sells.</p>}
      </>)}
    </fieldset>
  );
}

/** Content labels. Labeled art is blurred for buyers until they tap. */
export function SensitiveField({ sensitive, setSensitive }: { sensitive: string[]; setSensitive: Setter<string[]> }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1">
        <span className="t-card">Sensitive?</span>
        <span className="t-small ml-2">Buyers see it blurred until they tap.</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {SENSITIVE_LABELS.map((l) => {
          const on = sensitive.includes(l);
          return (
            <label key={l} className={cn("flex cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-2 text-[14px] font-semibold transition focus-within:ring-[3px] focus-within:ring-scan/40", on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => setSensitive(on ? sensitive.filter((x) => x !== l) : [...sensitive, l])} />
              <span aria-hidden="true" className={cn("grid h-4 w-4 place-items-center rounded-[4px] border-2", on ? "border-sticker bg-sticker text-ink" : "border-ink/40")}>{on && <Check className="h-3 w-3" />}</span>
              {l}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "This is my original work…" (`many` words it for a whole queue). */
export function OwnershipField({ owned, setOwned, many, note }: { owned: boolean; setOwned: Setter<boolean>; many?: boolean; note?: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-white p-3 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", owned ? "border-ink" : "border-line hover:border-ink-2")}>
      <input id={FIELD_ID.ownership} type="checkbox" className="sr-only" checked={owned} onChange={(e) => setOwned(e.target.checked)} required />
      <span aria-hidden="true" className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border-2", owned ? "border-ink bg-sticker" : "border-ink/40")}>{owned && <Check className="h-3.5 w-3.5" />}</span>
      <span className="text-[14.5px] leading-snug">
        <b>{many ? "These are all my original works and I hold the rights to sell prints of them." : "This is my original work and I hold the rights to sell prints of it."}</b>
        {note && <span className="t-small block">{note}</span>}
      </span>
    </label>
  );
}
