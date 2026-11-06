"use client";
// One painting in a scan booking (admin): upload its high-res scan onto the artwork, see the print sizes before and
// after, or undo. POST/DELETE /api/admin/scanning/items/[itemId].
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageOff, Loader2, Undo2, Upload } from "lucide-react";
import { PRINT_SIZES, SIZE_LABEL } from "@/components/art/pricing";
import { cantReason } from "@/lib/adminCaps";
import { useAdminCan } from "../../_components/AdminRole";
import { cn } from "@/lib/utils";

export type ScanItemView = {
  id: string; band: string; title: string | null; artworkId: string | null; slug: string | null; imageUrl: string | null;
  printableNow: string[]; before: string[]; scanned: boolean; canUndo: boolean; size: string | null;
};

function Sizes({ sizes, label }: { sizes: string[]; label: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1 text-[12px]">
      <span className="text-ink-2">{label}</span>
      {PRINT_SIZES.map((s) => {
        const ok = !sizes.length || sizes.includes(s);
        return <span key={s} className={cn("rounded-full border px-1.5 font-semibold", ok ? "border-earned/40 bg-earned-soft" : "border-line text-ink-2 line-through")}>{SIZE_LABEL[s]}<span className="sr-only">{ok ? "" : " (too small)"}</span></span>;
      })}
      {!sizes.length && <span className="text-ink-2">(not checked)</span>}
    </span>
  );
}

export default function ScanFileRow({ item, canFile, options }: { item: ScanItemView; canFile: boolean; options: { id: string; title: string }[] }) {
  const router = useRouter();
  const allowed = useAdminCan("orders");
  const fileRef = useRef<HTMLInputElement>(null);
  const [artworkId, setArtworkId] = useState(item.artworkId ?? options[0]?.id ?? "");
  const [busy, setBusy] = useState<"upload" | "undo" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy("upload");
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    if (!item.artworkId && artworkId) fd.append("artworkId", artworkId);
    try {
      const r = await fetch(`/api/admin/scanning/items/${item.id}`, { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Upload failed. Try again.");
      const top = [...PRINT_SIZES].reverse().find((s) => (d.printable as string[]).includes(s));
      toast.success(`Scan is on the artwork: ${d.width} × ${d.height} px`, { description: top ? `Prints up to ${SIZE_LABEL[top]} now.` : undefined });
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message || "Upload failed. Try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  async function undo() {
    setBusy("undo");
    setError(null);
    try {
      const r = await fetch(`/api/admin/scanning/items/${item.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Couldn't undo. Try again.");
      toast.success(d.message || "Previous image put back.");
      router.refresh();
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  const needsLink = !item.artworkId;
  return (
    <li className={cn("grid gap-3 rounded-xl border p-3 sm:grid-cols-[72px_minmax(0,1fr)]", item.scanned ? "border-earned/40 bg-earned-soft/40" : "border-line")}>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-[72px] w-[72px] rounded-[3px] bg-gallery object-cover" />
      ) : (
        <span className="grid h-[72px] w-[72px] place-items-center rounded-[3px] bg-wall"><ImageOff className="h-5 w-5 text-ink-2" aria-hidden="true" /></span>
      )}
      <div className="grid min-w-0 gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <b className="truncate text-[15px]">
            {item.slug ? <Link href={`/admin/artworks/${item.artworkId}/edit`} className="text-ink">{item.title}</Link> : item.title || "Not uploaded yet"}
          </b>
          <span className="text-[13px] text-ink-2">{item.band}{item.size ? ` · ${item.size}` : ""}{item.scanned ? " · scanned" : ""}</span>
        </div>
        {item.artworkId && (item.scanned ? (
          <>
            <Sizes sizes={item.before} label="Before" />
            <Sizes sizes={item.printableNow} label="Now" />
          </>
        ) : (
          <Sizes sizes={item.printableNow} label="Prints now" />
        ))}
        {needsLink && canFile && (
          options.length ? (
            <label className="grid gap-1 text-[13px] font-semibold">
              Put the scan on which of their artworks?
              <select value={artworkId} onChange={(e) => setArtworkId(e.target.value)} className="min-h-[40px] rounded-lg border-[1.5px] border-line bg-white px-2 text-[14px] font-normal text-ink">
                {options.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
              </select>
            </label>
          ) : (
            <p className="text-[13px] text-ink-2">The artist hasn&apos;t uploaded this piece yet. Ask them to upload a phone photo, then attach the scan here.</p>
          )
        )}
        {canFile && (!needsLink || options.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*,.tif,.tiff" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
            <button type="button" disabled={!!busy || !allowed} title={allowed ? undefined : cantReason("orders")} onClick={() => fileRef.current?.click()} className={cn("btn btn-sm", item.scanned ? "btn-ghost" : "btn-blue")}>
              {busy === "upload" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
              {busy === "upload" ? "Uploading…" : item.scanned ? "Replace scan" : "Upload scan"}
            </button>
            {item.canUndo && (
              <button type="button" disabled={!!busy || !allowed} onClick={undo} className="btn btn-ghost btn-sm">
                {busy === "undo" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Undo2 className="h-4 w-4" aria-hidden="true" />}Undo
              </button>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-[13px] font-semibold text-coral">{error}</p>}
      </div>
    </li>
  );
}
