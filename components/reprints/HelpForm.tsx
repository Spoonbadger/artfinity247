"use client";

// The buyer's side of /order/[orderId]/help: pick the print(s), say what went wrong, add 1–3 photos and a note.
import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, Minus, Plus, X } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { MAX_NOTE, MAX_PHOTOS, REPRINT_REASONS, type ReprintReason } from "@/lib/reprintFormat";

export type HelpItem = { id: string; title: string; imageUrl: string; detail: string; quantity: number };


export default function HelpForm({ orderId, token, items }: { orderId: string; token: string; items: HelpItem[] }) {
  const [picked, setPicked] = useState<Record<string, number>>(() => (items.length === 1 ? { [items[0].id]: 1 } : {}));
  const [reason, setReason] = useState<ReprintReason | "">("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (it: HelpItem) => setPicked((p) => {
    const n = { ...p };
    if (n[it.id]) delete n[it.id]; else n[it.id] = 1;
    return n;
  });
  const setQty = (it: HelpItem, q: number) => setPicked((p) => ({ ...p, [it.id]: Math.min(it.quantity, Math.max(1, q)) }));

  const upload = async (files: FileList) => {
    setError("");
    const room = MAX_PHOTOS - photos.length;
    const list = Array.from(files).slice(0, room);
    if (!list.length) return;
    setUploading(list.length);
    await Promise.all(list.map(async (file) => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("helpOrder", orderId);
        fd.append("helpToken", token);
        const r = await fetch("/api/uploads", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.url) throw new Error(j.error || "That photo didn't upload.");
        setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, j.url] : p));
      } catch (e: any) {
        setError(e?.message || "That photo didn't upload.");
      } finally {
        setUploading((n) => n - 1);
      }
    }));
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = async () => {
    const chosen = Object.entries(picked).map(([id, qty]) => ({ id, qty }));
    if (!chosen.length) { setError("Pick the print that needs fixing."); return; }
    if (!reason) { setError("Pick what went wrong."); return; }
    if (!photos.length) { setError("Add a photo of the problem."); return; }
    setSending(true); setError("");
    try {
      const r = await fetch("/api/reprints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, t: token, items: chosen, reason, photos, note }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send. Try again.");
      setSent(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e?.message || "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <section aria-live="polite" className="relative grid justify-items-center gap-3 rounded-2xl bg-sticker/40 px-5 py-9 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-earned text-white"><Check className="h-6 w-6" aria-hidden="true" /></span>
        <h2 className="t-section relative">
          Got it, thank you
          <BrushStroke className="mx-auto mt-1 h-2.5 w-40" color="var(--af-coral)" />
        </h2>
        <p className="t-body max-w-[34ch] text-ink-2">We&apos;ll look today or tomorrow and email you. If it&apos;s on us, we reprint it free. No need to send anything back.</p>
        <Link href="/" className="btn btn-ghost mt-1">Back to Artfinity</Link>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      {/* 1. Which print */}
      <fieldset className="grid gap-2.5">
        <legend className="t-card mb-2">{items.length > 1 ? "Which prints?" : "Your print"}</legend>
        <ul className="grid gap-2.5">
          {items.map((it) => {
            const on = !!picked[it.id];
            return (
              <li key={it.id} className={cn("af-card overflow-hidden transition", on ? "ring-2 ring-ink" : "")}>
                <label className="flex cursor-pointer items-center gap-3.5 p-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan">
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(it)} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.imageUrl} alt="" className="h-[68px] w-[54px] shrink-0 rotate-[-2deg] rounded-[2px] border-[3px] border-white object-cover shadow-[0_6px_14px_-8px_rgba(21,22,27,.6)]" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <b className="t-card block truncate">{it.title}</b>
                    <span className="t-small block truncate">{it.detail}{it.quantity > 1 ? ` · ${it.quantity} prints` : ""}</span>
                  </span>
                  <span aria-hidden="true" className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", on ? "border-ink bg-ink text-white" : "border-ink/30")}>
                    {on && <Check className="h-4 w-4" />}
                  </span>
                </label>
                {on && it.quantity > 1 && (
                  <div className="flex items-center justify-between gap-3 border-t border-line bg-wall/60 px-3 py-2">
                    <span className="text-[14px] font-semibold">How many need fixing?</span>
                    <span className="flex items-center gap-1">
                      <button type="button" onClick={() => setQty(it, picked[it.id] - 1)} className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-ink bg-white" aria-label="One fewer" title="One fewer"><Minus className="h-4 w-4" aria-hidden="true" /></button>
                      <span className="num w-8 text-center text-[16px] font-bold" aria-live="polite">{picked[it.id]}</span>
                      <button type="button" onClick={() => setQty(it, picked[it.id] + 1)} className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-ink bg-white" aria-label="One more" title="One more"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      {/* 2. What went wrong */}
      <fieldset className="grid gap-2.5">
        <legend className="t-card mb-2">What went wrong?</legend>
        <div className="grid gap-2">
          {REPRINT_REASONS.map((r) => (
            <label key={r.id} className={cn("flex min-h-[52px] cursor-pointer items-center gap-3 rounded-xl border-2 bg-white px-3.5 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", reason === r.id ? "border-ink bg-[#fffbe8]" : "border-line hover:border-ink-2")}>
              <input type="radio" name="reason" className="sr-only" checked={reason === r.id} onChange={() => { setReason(r.id); setError(""); }} />
              <span aria-hidden="true" className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", reason === r.id ? "border-ink" : "border-ink/40")}>{reason === r.id && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
              <b className="text-[15.5px]">{r.label}</b>
            </label>
          ))}
        </div>
      </fieldset>

      {/* 3. Photos */}
      <section className="grid gap-2.5" aria-labelledby="photos-h">
        <h2 id="photos-h" className="t-card flex items-baseline gap-2">Photos <span className="t-small font-normal">1 to {MAX_PHOTOS}</span></h2>
        <p className="t-small -mt-1">Show the problem up close. For shipping damage, a photo of the box helps too.</p>
        <div className="flex flex-wrap gap-3">
          {photos.map((p) => (
            <div key={p} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="Your photo" className="h-28 w-28 rounded-[3px] border-4 border-white object-cover shadow-[0_8px_20px_-10px_rgba(21,22,27,.5)]" />
              <button type="button" onClick={() => setPhotos((ps) => ps.filter((x) => x !== p))} aria-label="Remove photo" title="Remove photo" className="absolute -right-2.5 -top-2.5 grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-ink bg-white text-ink">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          {photos.length + uploading < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading > 0}
              className={cn("grid place-items-center gap-1 rounded-xl border-2 border-dashed border-line bg-white text-[14px] font-semibold text-ink transition hover:border-ink disabled:opacity-60", photos.length ? "h-28 w-28" : "h-28 w-full")}
            >
              <span className="grid justify-items-center gap-1">
                <Camera className="h-6 w-6" aria-hidden="true" />
                {uploading ? "Uploading…" : photos.length ? "Add another" : "Take or add a photo"}
              </span>
            </button>
          )}
          {uploading > 0 && photos.length + uploading >= MAX_PHOTOS && <p className="self-center text-[14px] text-ink-2">Uploading…</p>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); }} />
      </section>

      {/* 4. Note */}
      <label className="af-field">
        <span className="label">Anything else? (optional)</span>
        <textarea rows={3} maxLength={MAX_NOTE} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A corner is bent, the colors look off…" className="resize-none text-[16px] leading-snug" />
      </label>

      {error && <p role="alert" className="text-[14.5px] font-semibold text-coral">{error}</p>}

      <div className="grid gap-2">
        <button type="button" onClick={send} disabled={sending || uploading > 0} className="btn btn-blue btn-lg w-full sm:w-fit">
          {sending ? "Sending…" : "Send to Artfinity"}
        </button>
        <p className="t-small">A person looks at every request. No need to send the print back. Artfinity pays for reprints, not the artist.</p>
      </div>
    </div>
  );
}
