"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useEffect, useRef, useState } from "react";
import { errorText, failed, saved as savedToast } from "@/lib/feedback";
import { Problem } from "./Problem";
import AddToQueueButton from "@/components/qr/AddToQueueButton";
import { Crop, FolderOpen, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import type { SizeKey } from "@/lib/earnings";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { artPath } from "@/lib/urls";
import { splitOriginal } from "@/lib/originalSize";
import { FREE_SPLIT, pct } from "@/lib/plans";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import ImageEditor, { type EditResult } from "@/components/media/ImageEditor";
import { parseStored, type StoredEdits } from "@/lib/imageEdits";
import {
  artworkFormData, checkArtwork, DetailsFields, EditionField, filesFromDrop, isImageFile, OwnershipField, PriceFields,
  pricesFrom, PrintSizes, REVIEW_NOTE, scanHref, SensitiveField, saveProblem, titleFromFile, TOO_SMALL, useLastPrices, usePriceGuide, type ArtworkValues, type Prices,
} from "./artworkFields";
import {
  Cancelled, cloudImportAvailable, CloudImportButtons, ImportFailed, importCloudFile, importFix, importingLabel, isCloudImage, pickCloud,
  type CloudFile, type CloudSource, type UploadedImage,
} from "./cloudImport";

type ProblemFix = { label: string; href?: string; onClick?: () => void };

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
  editionSize?: number | null;
  /** Prints already sold (an edition can't go below this). */
  sold?: number;
  /** Sizes the current image prints sharply; empty = never checked. */
  printableSizes?: string[];
  /** Photo edits behind imageUrl (Artwork.imageEdits), so "Edit photo" reopens them on the untouched original. */
  imageEdits?: unknown;
};

/**
 * The upload / edit form. `onManyFiles` (new uploads by an artist who already has work) lets the picker and the
 * drop zone take several files or a whole folder; more than one image hands them to the upload queue.
 * New uploads can also come from Google Drive or Dropbox (./cloudImport.tsx): several picked files go to the queue
 * through `onCloudFiles`; one (or the first, for an artist's very first upload) is imported straight into this form.
 */
export default function ArtworkForm({ artwork, split, handle, onManyFiles, onCloudFiles, mock }: {
  artwork?: ArtworkInput;
  split?: number;
  handle: string;
  onManyFiles?: (files: File[]) => void;
  onCloudFiles?: (files: CloudFile[]) => void;
  /** Dev-only sample import button (ALLOW_MOCK_IMPORT=1). */
  mock?: boolean;
}) {
  const router = useRouter();
  const editing = !!artwork;
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const many = !editing && !!onManyFiles;

  const [imageUrl, setImageUrl] = useState(artwork?.imageUrl || "");
  // A fresh upload's measured sizes and their signature from /api/uploads.
  const [fresh, setFresh] = useState<{ printable: SizeKey[]; sig: string } | null>(null);
  // Print sizes after an "Edit photo" that was saved straight to this piece.
  const [committed, setCommitted] = useState<SizeKey[] | null>(null);
  const stored = committed ?? (artwork?.printableSizes?.length ? (artwork.printableSizes as SizeKey[]) : null);
  // Photo edits behind the image (components/media/ImageEditor.tsx) and whether the editor is open.
  const [edits, setEdits] = useState<StoredEdits | null>(() => parseStored(artwork?.imageEdits));
  const [editor, setEditor] = useState<{ auto: boolean } | null>(null);
  const printable = fresh ? fresh.printable : stored;
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  // Shown image's pixel size, for the crop previews' orientation.
  const [shape, setShape] = useState<{ w: number; h: number } | null>(null);
  const [owned, setOwned] = useState(false);
  const needsOwnership = !editing || !!fresh;
  // What's happening to the image right now ("Uploading", "Importing from Drive…"), or null.
  const [uploading, setUploading] = useState<string | null>(null);
  // A cloud import that failed and can be tried again, plus a note when only the first picked file was taken.
  const [retryCloud, setRetryCloud] = useState<CloudFile | null>(null);
  const [cloudNote, setCloudNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // The original's size is saved as the description's first line ("Original: 24 × 30 in", lib/originalSize.ts).
  const [parsed] = useState(() => splitOriginal(artwork?.description));
  const [v, setV] = useState<ArtworkValues>(() => ({
    title: artwork?.title || "",
    description: parsed.body,
    origW: parsed.original ? String(parsed.original.w) : "",
    origH: parsed.original ? String(parsed.original.h) : "",
    prices: pricesFrom(artwork),
    sensitive: artwork?.sensitive || [],
    limited: !!artwork?.editionSize,
    edition: String(artwork?.editionSize || 25),
  }));
  const set = (patch: Partial<ArtworkValues>) => setV((cur) => ({ ...cur, ...patch }));
  const setPrices = (fn: (p: Prices) => Prices) => setV((cur) => ({ ...cur, prices: fn(cur.prices) }));
  const guide = usePriceGuide();
  // New pieces start from the artist's last prices.
  useLastPrices(!editing, (prices) => set({ prices }));
  const sold = artwork?.sold ?? 0;
  // Once a print sells, the edition is a promise to buyers: no resizing, no open/limited switch (server enforces it too).
  const editionLocked = editing && sold > 0;
  const [saving, setSaving] = useState(false);
  // The error under the form, with the button that fixes it (pick another file, try again, the page that fixes it).
  const [error, setErrorState] = useState<{ message: string; fix?: ProblemFix } | null>(null);
  const setError = (message: string | null, fix?: ProblemFix) => setErrorState(message ? { message, fix } : null);
  const pickFile = (label = "Pick another file"): ProblemFix => ({ label, onClick: () => fileRef.current?.click() });
  // notice: set when the image looks like one already on Artfinity (lib/imageHash.ts); duplicate "review" = a person checks it.
  // moderation (automatic image check, lib/moderation): "review" = held for a person; "labeled" = a label was added (notice says which).
  const [done, setDone] = useState<{ slug: string; title: string; imageUrl: string; pending: boolean; notice?: string | null; duplicate?: string | null; moderation?: string | null } | null>(null);
  // Warn before leaving with unsaved edits (an edit that changed something, or a new piece with a photo or title).
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(v) + (artwork?.imageUrl || ""));
  useUnsavedChanges(!done && !saving && (editing ? JSON.stringify(v) + imageUrl !== snapshot : !!imageUrl || !!v.title.trim()));

  // React has no prop for folder picking.
  useEffect(() => { folderRef.current?.setAttribute("webkitdirectory", ""); }, [many]);

  /** The image is stored (device upload or cloud import, same result): show it with its print sizes. */
  function applyImage(data: UploadedImage, fileName: string) {
    setImageUrl(data.url);
    setShape(null);
    setFresh({ printable: (data.printable || []) as SizeKey[], sig: data.printableSig || "" });
    setDims(data.width ? { w: data.width, h: data.height } : null);
    setV((cur) => (cur.title ? cur : { ...cur, title: titleFromFile(fileName) }));
    // A new photo: no edits yet, and the editor opens so the artist can crop or fix the angle (or skip).
    setEdits(null);
    setEditor({ auto: true });
  }

  /** "Edit photo" on an image that's already saved on this piece: store it right away (no rights box: same picture). */
  async function commitEdit(r: EditResult) {
    if (!editing || fresh) return;
    const fd = new FormData();
    fd.append("imageUrl", r.url);
    fd.append("printable", r.printable.join(","));
    fd.append("printableSig", r.printableSig);
    fd.append("imageEdits", r.edits ? JSON.stringify(r.edits) : "");
    const res = await fetch(`/api/artworks/update/${artwork!.slug}`, { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) throw new Error((await saveProblem(res)).message);
  }

  /** The editor closed: show the edited image (or nothing changed). */
  function editDone(r: EditResult | null) {
    setEditor(null);
    if (!r) return;
    const before = imageUrl;
    setImageUrl(r.url);
    setShape(null);
    setDims({ w: r.width, h: r.height });
    setEdits(r.edits);
    if (editing && !fresh) {
      setCommitted(r.printable as SizeKey[]);
      setSnapshot((s) => (s.endsWith(before) ? s.slice(0, s.length - before.length) + r.url : s));
      router.refresh();
    } else {
      setFresh({ printable: r.printable as SizeKey[], sig: r.printableSig });
    }
  }

  async function upload(file: File) {
    setError(null);
    setRetryCloud(null);
    setCloudNote(null);
    if (!isImageFile(file)) { setError("Pick an image file: JPG, PNG, WEBP or HEIC.", pickFile()); return; }
    setUploading("Uploading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed. Try again.");
      applyImage(data, file.name);
    } catch (e) {
      const offline = e instanceof TypeError;
      setError(errorText(e, "Upload failed. Try again."), offline ? { label: "Try again", onClick: () => upload(file) } : pickFile());
    } finally {
      setUploading(null);
    }
  }

  async function importOne(file: CloudFile) {
    setError(null);
    setRetryCloud(null);
    setUploading(importingLabel(file.source));
    try {
      const data = await importCloudFile(file);
      applyImage(data, file.name);
      if (data.duplicate) setCloudNote(`This looks like “${data.duplicate.title}”, already on your page. Publish it anyway if it's a different version.`);
    } catch (e: any) {
      // Expired link or a file we can't print: the fix is picking again (cloudImport.tsx importFix).
      const fix = e instanceof ImportFailed ? importFix(e.code, file.source) : null;
      setError(errorText(e, "Import failed. Try again."), fix ? (fix.href ? { label: fix.label, href: fix.href } : { label: fix.label, onClick: () => repickCloud(file.source) }) : undefined);
      if (!(e instanceof ImportFailed) || e.retry) setRetryCloud(file);
    } finally {
      setUploading(null);
    }
  }

  async function repickCloud(source: CloudSource) {
    setError(null);
    try {
      takeCloud(await pickCloud(source, many ? undefined : 1));
    } catch (e) {
      if (!(e instanceof Cancelled)) setError(errorText(e, "Couldn't open the picker."), { label: "Try again", onClick: () => repickCloud(source) });
    }
  }

  /** Picked in Drive / Dropbox: several go to the queue; otherwise the first is imported here. */
  function takeCloud(files: CloudFile[]) {
    const images = files.filter(isCloudImage);
    setCloudNote(null);
    if (!images.length) { setError("Pick an image file: JPG, PNG, WEBP or HEIC.", pickFile()); return; }
    if (many && images.length > 1 && onCloudFiles) { onCloudFiles(images); return; }
    if (images.length > 1) setCloudNote(`We took the first one, ${images[0].name}. You can add more after your first piece is published.`);
    importOne(images[0]);
  }

  /** One image: the usual form. Several (and no image here yet): the upload queue. */
  function take(files: File[]) {
    const images = files.filter(isImageFile);
    if (!images.length) { if (files.length) setError(files.length > 1 ? "No images in there. Pick JPG, PNG, WEBP or HEIC files." : "Pick an image file: JPG, PNG, WEBP or HEIC.", pickFile()); return; }
    if (many && images.length > 1 && onManyFiles) onManyFiles(images);
    else upload(images[0]);
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (many) take(await filesFromDrop(e.dataTransfer));
    else { const f = e.dataTransfer.files?.[0]; if (f) upload(f); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = checkArtwork(v, { imageUrl, printable, editionLocked, needsOwnership, owned });
    if (problem) {
      const focus = problem.focus;
      const fix: ProblemFix | undefined = !imageUrl ? pickFile("Choose an image") : problem.message === TOO_SMALL ? pickFile("Pick a bigger file")
        : focus ? { label: "Show me", onClick: () => document.getElementById(focus)?.focus() } : undefined;
      setError(problem.message, fix);
      if (focus) document.getElementById(focus)?.focus();
      return;
    }
    setSaving(true);
    try {
      const fd = artworkFormData(v, { imageUrl, fresh, editionLocked, ownership: needsOwnership && owned, edits: !editing || fresh ? edits : undefined });
      const res = await fetch(editing ? `/api/artworks/update/${artwork!.slug}` : "/api/artworks/upload", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) {
        const p = await saveProblem(res);
        const retry: ProblemFix = { label: "Try again", onClick: () => formRef.current?.requestSubmit() };
        const fix: ProblemFix | undefined = p.code === "image_too_small" ? pickFile("Pick a bigger file") : p.code === "reupload" ? pickFile("Upload it again") : p.fix ?? (res.status >= 500 || res.status === 429 ? retry : undefined);
        setError(p.message, fix);
        return;
      }
      const saved = await res.json();
      if (editing) {
        if (saved.duplicate === "review") savedToast(saved.notice);
        else savedToast(saved.status === "PENDING" && fresh ? `Saved. New image ${REVIEW_NOTE.toLowerCase()}.` : saved.notice ? `Saved. ${saved.notice}` : "Saved", { next: { label: "Print code", href: `/studio/qr?art=${saved.slug || artwork!.slug}` } });
        router.push("/studio/art");
        router.refresh();
      } else {
        setDone({ slug: saved.slug, title: saved.title, imageUrl: saved.imageUrl, pending: saved.status === "PENDING", notice: saved.notice, duplicate: saved.duplicate, moderation: saved.moderation });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      const msg = errorText(e, "Could not save. Try again.");
      setError(msg, { label: "Try again", onClick: () => formRef.current?.requestSubmit() });
      failed(msg, { retry: () => formRef.current?.requestSubmit() });
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="af-card mx-auto grid max-w-[640px] gap-5 p-5 text-center sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={done.imageUrl} alt={done.title} className="mx-auto max-h-[340px] w-auto rounded-[3px] shadow-[0_10px_30px_rgba(21,22,27,.18)]" />
        {done.pending ? (
          <div className="grid justify-items-center gap-3">
            <span className="sticker-badge">{REVIEW_NOTE}</span>
            <h2 className="display text-[40px]">Almost on the wall.</h2>
            <p className="text-ink-2">{done.duplicate === "review" || done.moderation === "review" ? done.notice : <>We look over every new artist&apos;s first pieces.</>} We&apos;ll email you when {done.title} is live. You can print its code now.</p>
          </div>
        ) : (
          <div>
            <h2 className="display text-[40px]">It&apos;s live.</h2>
            <p className="mt-2 text-ink-2">{done.title} is on your page. Next: hang its code.</p>
            {done.notice && <p className="mt-2 text-[13.5px] text-ink-2">{done.notice}</p>}
          </div>
        )}
        <div className="flex flex-wrap justify-center gap-2">
          <Link href={`/studio/qr?art=${done.slug}`} className="btn btn-blue">Print its code</Link>
          <AddToQueueButton slug={done.slug} title={done.title} />
          <Link href={artPath(handle, done.slug)} className="btn btn-ghost">View</Link>
          <button type="button" className="btn btn-ghost" onClick={() => { setDone(null); setImageUrl(""); setFresh(null); setShape(null); setOwned(false); setDims(null); set({ title: "", description: "", origW: "", origH: "", sensitive: [], limited: false }); }}>
            Upload another
          </button>
        </div>
      </div>
    );
  }

  const ready = (s: SizeKey) => !printable || printable.includes(s);

  return (
    <form ref={formRef} onSubmit={submit} className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-10" noValidate>
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
          <input
            ref={fileRef} type="file" accept="image/*" className="sr-only" multiple={many && !imageUrl}
            onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) take(fs); }}
            aria-label={imageUrl ? "Replace image" : many ? "Choose images" : "Choose an image"}
          />
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl} alt={v.title || "Your artwork"}
              onLoad={(e) => setShape({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              className="max-h-[520px] w-auto max-w-full rounded-[2px] shadow-[0_12px_30px_rgba(21,22,27,.22)]"
            />
          ) : (
            <span className="grid justify-items-center gap-3">
              <span className="relative grid h-16 w-16 place-items-center">
                <i className="paint-dab absolute inset-0 h-16 w-16 opacity-90" style={{ ["--dab" as string]: "#ffd43b" }} />
                <ImagePlus className="relative h-7 w-7" aria-hidden="true" />
              </span>
              <b className="font-display text-[22px] [font-variation-settings:'wdth'_80]">Drop your art here</b>
              <span className="text-[13.5px] text-ink-2">or tap to pick {many ? "files" : "a file"} · JPG, PNG, HEIC · up to 25 MB</span>
              {many && <span className="max-w-[300px] text-[13px] font-semibold text-ink">Several at once? Drop them all, or a whole folder.</span>}
            </span>
          )}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-white/80 text-[15px] font-bold" role="status">
              <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />{uploading}</span>
            </span>
          )}
        </label>
        {many && !imageUrl && (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={folderRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const fs = Array.from(e.target.files || []); e.target.value = ""; if (fs.length) take(fs); }} />
            <button type="button" onClick={() => folderRef.current?.click()} className="btn btn-ghost btn-sm"><FolderOpen className="h-4 w-4" aria-hidden="true" />Choose a folder</button>
            <Link href="/help/getting-started/upload-several" target="_blank" className="text-[13px] text-scan underline-offset-2 hover:underline">How it works</Link>
          </div>
        )}
        {!editing && !imageUrl && cloudImportAvailable(mock) && (
          <div className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-ink-2">Or import from</span>
            <CloudImportButtons onPick={takeCloud} mock={mock} max={many ? undefined : 1} disabled={!!uploading} />
            {!many && <p className="text-[12.5px] text-ink-2">Start with one piece. Import more once it&apos;s live.</p>}
          </div>
        )}
        {cloudNote && <p role="status" className="rounded-lg bg-wall px-3 py-2 text-[13px]">{cloudNote}</p>}
        {retryCloud && !uploading && (
          <button type="button" className="btn btn-ghost btn-sm justify-self-start" onClick={() => importOne(retryCloud)}><RotateCcw className="h-4 w-4" aria-hidden="true" />Retry import</button>
        )}
        {imageUrl && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditor({ auto: false })} className="btn btn-ghost btn-sm" disabled={!!uploading}><Crop className="h-4 w-4" aria-hidden="true" />Edit photo</button>
            <button type="button" onClick={() => fileRef.current?.click()} className="btn btn-ghost btn-sm">Replace image</button>
          </div>
        )}
        {editor && imageUrl && (
          <ImageEditor
            source={edits?.source ?? imageUrl}
            sourceSize={edits ? (edits.sourceW ? { w: edits.sourceW, h: edits.sourceH } : null) : dims}
            initial={edits} previous={edits ? imageUrl : null} auto={editor.auto}
            originalSize={parseFloat(v.origW) > 0 && parseFloat(v.origH) > 0 ? { w: parseFloat(v.origW), h: parseFloat(v.origH) } : null}
            commit={editing && !fresh ? commitEdit : undefined}
            onDone={editDone}
          />
        )}
        {printable && imageUrl && <PrintSizes imageUrl={imageUrl} printable={printable} dims={dims} shape={shape} scanSlug={artwork?.slug ?? null} />}
      </div>

      {/* Details */}
      <div className="grid gap-6">
        <DetailsFields v={v} set={set} />
        <PriceFields prices={v.prices} setPrices={setPrices} ready={ready} split={split} guide={guide} />
        <EditionField
          limited={v.limited} edition={v.edition} setLimited={(limited) => set({ limited })} setEdition={(edition) => set({ edition })}
          locked={editionLocked ? { editionSize: artwork?.editionSize ?? null, sold } : undefined}
        />
        <SensitiveField sensitive={v.sensitive} setSensitive={(sensitive) => set({ sensitive })} />

        {needsOwnership && (
          <OwnershipField owned={owned} setOwned={setOwned} note={!editing ? <>New artists&apos; first few pieces get a quick look before they go live.</> : undefined} />
        )}

        {error && <Problem tone="error" title={error.message} fix={error.fix} secondary={error.message === TOO_SMALL ? { label: "Book a scan", href: scanHref(artwork?.slug) } : undefined} />}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-blue btn-lg relative z-0" disabled={saving || !!uploading}>
            {saving && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {editing ? "Save changes" : "Put it on my page"}
          </button>
          <Link href="/studio/art" className="btn btn-ghost">Cancel</Link>
          {!editing && (
            <span className="relative z-0 text-[13px] text-ink-2">
              Free to list. <span className="relative inline-block font-semibold text-ink">You keep {pct(split ?? FREE_SPLIT)} of profit<BrushStroke className="absolute -bottom-1 left-0 -z-10 h-2 w-full" /></span>
            </span>
          )}
        </div>
      </div>
    </form>
  );
}

