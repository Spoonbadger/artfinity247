"use client";

// The buyer's side of /review/[orderId]: one card per print with paint-dab rating, a few words and an optional wall photo.
import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, X } from "lucide-react";
import { BrushStroke } from "@/components/af/Brush";
import { cn } from "@/lib/utils";
import { RATING_WORDS, shortName } from "./format";
import { Dabs } from "./ReviewStars";

export type ReviewFormItem = {
  id: string;
  title: string;
  imageUrl: string;
  sizeLabel: string;
  artistName: string;
  artistSlug: string | null;
  /** False when the artwork was removed; it can't be reviewed. */
  listed: boolean;
  existing: { rating: number; body: string; photoUrl: string | null; status: string; editable: boolean } | null;
};

const DAB_TILT = [-14, 8, -6, 12, -10];
const MAX_BODY = 600;

function DabPicker({ value, onChange, name }: { value: number; onChange: (n: number) => void; name: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="grid gap-1.5">
      <div role="radiogroup" aria-label={`Rating for ${name}`} className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5, ${RATING_WORDS[n]}`}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="grid h-12 w-12 place-items-center rounded-full transition active:scale-90"
          >
            <i
              className={cn("paint-dab h-9 w-9 transition", n <= shown ? "ring-0" : "ring-[1.5px] ring-inset ring-ink/20")}
              style={{ background: n <= shown ? "var(--af-sticker)" : "var(--af-wall)", transform: `rotate(${DAB_TILT[n - 1]}deg) scale(${n <= shown ? 1 : 0.86})` }}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <p className="h-5 pl-1 text-[14px] font-semibold text-ink-2" aria-live="polite">{shown ? RATING_WORDS[shown] : "Tap to rate"}</p>
    </div>
  );
}

function ItemCard({ item, orderId, token, name, city, onSaved }: {
  item: ReviewFormItem; orderId: string; token: string; name: string; city: string; onSaved: (id: string) => void;
}) {
  const ex = item.existing;
  const [editing, setEditing] = useState(!ex);
  const [rating, setRating] = useState(ex?.rating ?? 0);
  const [body, setBody] = useState(ex?.body ?? "");
  const [photo, setPhoto] = useState<string | null>(ex?.photoUrl ?? null);
  const [status, setStatus] = useState(ex?.status ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(!!ex);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("reviewOrder", orderId);
      fd.append("reviewToken", token);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(j.error || "That photo didn't upload.");
      setPhoto(j.url);
    } catch (e: any) {
      setError(e?.message || "That photo didn't upload.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!rating) { setError("Pick a rating first."); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, t: token, itemId: item.id, rating, body, photoUrl: photo, name, city }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't save. Try again.");
      setStatus(j.review?.status || "published");
      setSaved(true); setEditing(false);
      onSaved(item.id);
    } catch (e: any) {
      setError(e?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="af-card overflow-hidden">
      <div className="flex items-center gap-3.5 border-b border-line bg-wall/60 p-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt="" className="h-[72px] w-[58px] shrink-0 rotate-[-2deg] rounded-[2px] border-[3px] border-white object-cover shadow-[0_6px_14px_-8px_rgba(21,22,27,.6)]" />
        <div className="min-w-0 leading-tight">
          <b className="t-card block truncate">{item.title}</b>
          <span className="t-small block truncate">by {item.artistName}{item.sizeLabel ? ` · ${item.sizeLabel}` : ""}</span>
        </div>
      </div>

      <div className="grid gap-4 p-4">
        {!item.listed ? (
          <p className="t-muted">This piece isn&apos;t listed anymore, so it can&apos;t take reviews.</p>
        ) : saved && !editing ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2.5">
              <Dabs value={rating} size="md" />
              <span className="text-[14px] font-semibold text-ink-2">{RATING_WORDS[rating]}</span>
            </div>
            {body && <p className="whitespace-pre-line text-[16px] leading-relaxed">{body}</p>}
            {photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Your print on the wall" className="h-32 w-auto max-w-full rounded-[3px] border-4 border-white object-cover shadow-[0_8px_20px_-10px_rgba(21,22,27,.5)]" />
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-earned">
                <i className="paint-dab !h-3 !w-3" style={{ ["--dab" as string]: "var(--af-earned)" }} aria-hidden="true" />
                {status === "flagged" ? "Saved. It goes up after a quick check." : status === "hidden" ? "Saved." : "Saved and posted."}
              </span>
              {(ex ? ex.editable : true) && (
                <button type="button" onClick={() => setEditing(true)} className="ml-auto text-[14px] font-semibold text-ink underline underline-offset-4 hover:text-scan">
                  Edit
                </button>
              )}
            </div>
          </div>
        ) : (
          <>
            <DabPicker value={rating} onChange={(n) => { setRating(n); setError(""); }} name={item.title} />

            <label className="af-field">
              <span className="label">A few words (optional)</span>
              <textarea
                rows={3}
                maxLength={MAX_BODY}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Where did it go? What do you notice when you walk past?"
                className="resize-none text-[16px] leading-snug"
              />
            </label>

            {photo ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Your print on the wall" className="h-36 w-auto max-w-full rounded-[3px] border-4 border-white object-cover shadow-[0_8px_20px_-10px_rgba(21,22,27,.5)]" />
                <button type="button" onClick={() => setPhoto(null)} aria-label="Remove photo" title="Remove photo" className="absolute -right-2.5 -top-2.5 grid h-8 w-8 place-items-center rounded-full border-[1.5px] border-ink bg-white text-ink">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex min-h-[52px] items-center gap-3 rounded-xl border-2 border-dashed border-line bg-wall/50 px-4 text-left text-[15px] font-semibold text-ink transition hover:border-ink disabled:opacity-60"
              >
                <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
                {uploading ? "Uploading…" : <span>Add a photo of it on your wall <span className="font-normal text-ink-2">(optional)</span></span>}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />

            {error && <p role="alert" className="text-[14px] font-semibold text-coral">{error}</p>}

            <div className="flex items-center gap-3">
              <button type="button" onClick={save} disabled={saving || uploading} className="btn btn-blue flex-1 sm:flex-none">
                {saving ? "Saving…" : ex || saved ? "Save changes" : "Post review"}
              </button>
              {saved && (
                <button type="button" onClick={() => { setEditing(false); setError(""); }} className="btn btn-ghost">Cancel</button>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}

export default function ReviewForm({ orderId, token, items, defaultName, defaultCity }: {
  orderId: string; token: string; items: ReviewFormItem[]; defaultName: string; defaultCity: string;
}) {
  const [name, setName] = useState(defaultName);
  const [city, setCity] = useState(defaultCity);
  const [editingName, setEditingName] = useState(false);
  const [done, setDone] = useState<Set<string>>(() => new Set(items.filter((i) => i.existing).map((i) => i.id)));
  const [justSaved, setJustSaved] = useState(false);

  const reviewable = items.filter((i) => i.listed);
  const allDone = reviewable.length > 0 && reviewable.every((i) => done.has(i.id));
  const artists = Array.from(new Map(items.filter((i) => i.artistSlug).map((i) => [i.artistSlug!, i.artistName])).entries());

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl border border-edge bg-white px-3.5 py-2.5 text-[15px]">
        {editingName ? (
          <div className="grid w-full gap-2 sm:grid-cols-2">
            <label className="af-field">
              <span className="label">Your name</span>
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="af-field">
              <span className="label">City (optional)</span>
              <input value={city} maxLength={40} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />
            </label>
            <button type="button" onClick={() => setEditingName(false)} className="btn btn-ghost btn-sm w-fit">Done</button>
          </div>
        ) : (
          <>
            <span className="text-ink-2">Shown as</span>
            <b>{shortName(name)}</b>
            {city.trim() && <span className="text-ink-2">· {city.trim()}</span>}
            <button type="button" onClick={() => setEditingName(true)} className="ml-auto font-semibold underline underline-offset-4 hover:text-scan">Change</button>
          </>
        )}
      </div>

      <ul className="grid gap-5">
        {items.map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            orderId={orderId}
            token={token}
            name={name}
            city={city}
            onSaved={(id) => { setDone((s) => new Set(s).add(id)); setJustSaved(true); }}
          />
        ))}
      </ul>

      {allDone && justSaved && (
        <section aria-live="polite" className="relative grid justify-items-center gap-3 rounded-2xl bg-sticker/40 px-5 py-8 text-center">
          <h2 className="t-section relative">
            Thank you
            <BrushStroke className="mx-auto mt-1 h-2.5 w-36" color="var(--af-coral)" />
          </h2>
          <p className="t-body max-w-[34ch] text-ink-2">
            {artists.length === 1 ? `${artists[0][1]} gets an email about it. It really does make their week.` : "The artists get an email about it. It really does make their week."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {artists.map(([slug, artistName]) => (
              <Link key={slug} href={`/@${slug}`} className="btn btn-ghost">See more by {artistName.split(" ")[0]}</Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
