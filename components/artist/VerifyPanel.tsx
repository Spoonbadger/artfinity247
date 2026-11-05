"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import VerifiedBadge from "@/components/af/VerifiedBadge";
import { fmtDate, type Evidence, type VerificationStatus } from "./verification";
import HandleInput, { resolveHandle } from "@/components/forms/HandleInput";

type State = {
  status: VerificationStatus;
  verifiedAt: string | null;
  requestedAt: string | null;
  evidence: Evidence;
  note: string | null;
};

const STATUS_COPY: Record<VerificationStatus, { label: string; dab: string }> = {
  NONE: { label: "Not requested", dab: "var(--af-line)" },
  PENDING: { label: "Under review", dab: "var(--af-sticker)" },
  VERIFIED: { label: "Verified", dab: "var(--af-scan)" },
  REJECTED: { label: "Not approved", dab: "var(--af-coral)" },
};

export default function VerifyPanel({ initial, name, slug }: { initial: State; name: string; slug: string }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [editing, setEditing] = useState(initial.status === "NONE" || initial.status === "REJECTED");
  // Shown as the bare handle / tidy site; the server turns them back into links.
  const [instagram, setInstagram] = useState(() => { const r = resolveHandle("instagram", initial.evidence.instagram ?? ""); return r && "handle" in r ? r.handle : initial.evidence.instagram ?? ""; });
  const [website, setWebsite] = useState(() => { const r = resolveHandle("website", initial.evidence.website ?? ""); return r && "handle" in r ? r.handle : initial.evidence.website ?? ""; });
  const [photo, setPhoto] = useState(initial.evidence.photo ?? "");
  const [note, setNote] = useState(initial.evidence.note ?? "");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const igRef = useRef<HTMLInputElement>(null);
  // Which part of the form the error is about, so it can offer the fix right there.
  const errorAbout = !error ? null : /photo/i.test(error) ? "photo" : /instagram|website/i.test(error) ? "link" : null;

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "photo");
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.url) throw new Error(j.error || "Upload failed. Try again.");
      setPhoto(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!instagram.trim() && !website.trim()) return setError("Add your Instagram or website.");
    if (!photo) return setError("Add a photo of you with your work, or of your studio.");
    setSending(true);
    try {
      const res = await fetch("/api/studio/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram, website, photo, note }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Couldn't send. Try again.");
      setS({ status: j.verification, verifiedAt: j.verifiedAt, requestedAt: j.verificationRequestedAt, evidence: j.verificationEvidence, note: null });
      setEditing(false);
      toast.success("Sent. We'll email you when it's checked.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send. Try again.");
    } finally {
      setSending(false);
    }
  }

  const st = STATUS_COPY[s.status];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <div className="grid gap-5">
        {/* Status */}
        <section aria-label="Status" className="af-card grid gap-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="paint-dab h-4 w-5" style={{ ["--dab" as string]: st.dab }} aria-hidden="true" />
            <h2 className="text-[20px] font-bold">{st.label}</h2>
            {s.status === "PENDING" && s.requestedAt && <span className="text-[13.5px] text-ink-2">Sent {fmtDate(s.requestedAt)}</span>}
          </div>

          {s.status === "VERIFIED" && (
            <div className="flex flex-wrap items-center gap-4">
              <VerifiedBadge size={64} verifiedAt={s.verifiedAt} />
              <div className="grid gap-1">
                <b className="text-[17px]">Verified on {fmtDate(s.verifiedAt)}</b>
                <span className="text-[14px] text-ink-2">Buyers see the blue seal next to your name.</span>
                <Link href={`/@${slug}`} className="mt-1 text-[14px] font-bold text-scan">See your page</Link>
              </div>
            </div>
          )}

          {s.status === "PENDING" && (
            <>
              <p className="text-[14.5px] text-ink-2">A person on our team will check it. Usually within two days.</p>
              <EvidenceSummary e={s.evidence} />
              {!editing && (
                <button type="button" className="btn btn-ghost btn-sm w-fit" onClick={() => setEditing(true)}>
                  Update evidence
                </button>
              )}
            </>
          )}

          {s.status === "REJECTED" && (
            <>
              {s.note && (
                <blockquote className="rounded-xl border-l-4 border-coral bg-wall px-4 py-3 text-[15px] text-ink">
                  <span className="eyebrow mb-1 block">Note from Artfinity</span>
                  {s.note}
                </blockquote>
              )}
              <p className="text-[14.5px] text-ink-2">Fix what the note says and send it again.</p>
            </>
          )}

          {s.status === "NONE" && <p className="text-[14.5px] text-ink-2">Send a link and a photo. It takes a minute.</p>}
        </section>

        {/* Form */}
        {editing && s.status !== "VERIFIED" && (
          <form onSubmit={submit} className="af-card grid gap-4 p-4 sm:p-5" aria-labelledby="ev-h" noValidate>
            <h2 id="ev-h" className="text-[20px] font-bold">{s.status === "NONE" ? "Your evidence" : s.status === "PENDING" ? "Update evidence" : "Send it again"}</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <HandleInput ref={igRef} platform="instagram" name="instagram" label="Instagram" value={instagram} onChange={setInstagram} placeholder="yourhandle" />
              <HandleInput platform="website" name="website" label="Website" value={website} onChange={setWebsite} placeholder="yourname.com" />
            </div>
            <p className="-mt-2 text-[13px] text-ink-2">One is enough. It should show the name <b className="text-ink">{name}</b>.</p>

            <div className="grid gap-2">
              <span id="photo-l" className="text-[15px] font-bold">Photo of you with your work, or your studio</span>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-describedby="photo-l"
                  onClick={() => fileRef.current?.click()}
                  className="group relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-ink/30 bg-wall text-[13px] font-bold text-ink-2 hover:border-scan"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Your verification photo" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid justify-items-center gap-1.5">
                      <span className="paint-dab h-5 w-5" style={{ ["--dab" as string]: "var(--af-scan)" }} aria-hidden="true" />
                      {uploading ? "Uploading" : "Add photo"}
                    </span>
                  )}
                </button>
                {photo && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? "Uploading" : "Change photo"}
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label="Upload a photo of you with your work"
                  data-testid="verify-photo"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <label className="af-field">
              <span className="label">Note (optional)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} placeholder="Anything that helps, like where you show your work." />
            </label>

            {error && (
              <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-[#fff0ec] px-3 py-2 text-[14px] font-semibold text-[#b3311a]">
                <span className="min-w-0 flex-1">{error}</span>
                {errorAbout === "photo" && (
                  <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading}>Add photo</button>
                )}
                {errorAbout === "link" && (
                  <button type="button" className="btn btn-sm" onClick={() => igRef.current?.focus()}>Add a link</button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-blue" disabled={sending || uploading}>
                {sending ? "Sending" : "Send for review"}
              </button>
              {s.status === "PENDING" && (
                <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* What we check */}
      <aside className="af-panel grid gap-4 p-4 sm:p-5">
        <span className="eyebrow -mb-2">{s.status === "VERIFIED" ? "How buyers see you" : "How buyers will see you"}</span>
        <div className="flex items-center gap-3">
          <VerifiedBadge size={40} />
          <span className="text-[17px] font-bold">
            {name} <VerifiedBadge size={18} className="ml-0.5 align-[-3px]" />
          </span>
        </div>
        <h2 className="eyebrow">What we check</h2>
        <ul className="grid gap-3 text-[15px]">
          {[
            ["#b8c4ff", "Your name matches your link"],
            ["#f7c8a8", "The work on your page is yours"],
            ["var(--af-sticker)", "A real photo, not a stock one"],
          ].map(([c, t]) => (
            <li key={t} className="flex items-center gap-3">
              <span className="paint-dab" style={{ ["--dab" as string]: c }} aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
        <p className="border-t border-dashed border-line pt-3 text-[13px] text-ink-2">Medals come from sales. The seal comes from us.</p>
      </aside>
    </div>
  );
}

function EvidenceSummary({ e }: { e: Evidence }) {
  const items = [
    e.instagram && { k: "Instagram", v: e.instagram },
    e.website && { k: "Website", v: e.website },
  ].filter(Boolean) as { k: string; v: string }[];
  if (!items.length && !e.photo && !e.note) return null;
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl bg-wall p-3">
      {e.photo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={e.photo} alt="Your verification photo" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
      )}
      <dl className="grid min-w-0 flex-1 gap-1 text-[13.5px]">
        {items.map((i) => (
          <div key={i.k} className="flex min-w-0 gap-2">
            <dt className="shrink-0 font-semibold">{i.k}</dt>
            <dd className="truncate text-ink-2">{i.v.replace(/^https?:\/\//, "")}</dd>
          </div>
        ))}
        {e.note && (
          <div className="flex min-w-0 gap-2">
            <dt className="shrink-0 font-semibold">Note</dt>
            <dd className="text-ink-2">{e.note}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
