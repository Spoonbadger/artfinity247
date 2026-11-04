"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Camera, Check, Copy, Loader2 } from "lucide-react";
import { useUser } from "@/components/contexts";
import { BrushStroke } from "@/components/af/Brush";
import { Avatar } from "./StudioShell";
import { SHARED_KEY } from "./NextSteps";
import { cn } from "@/lib/utils";

type Profile = { name: string; city: string; bio: string; profileImage: string | null; venmoHandle: string };
type Art = { id: string; title: string; imageUrl: string; sensitive: string[] };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    try { msg = JSON.parse(t).error || t; } catch {}
    throw new Error(msg || "Could not save.");
  }
  return res.json();
}

export default function ProfileEditor({ initial, slug, art }: { initial: Profile; slug: string; art: Art[] }) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(initial);
  const [p, setP] = useState(initial);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = `theartfinity.com/@${slug}`;
  const dirty = p.name !== saved.name || p.city !== saved.city || p.bio !== saved.bio || p.venmoHandle !== saved.venmoHandle;

  async function changePhoto(file: File) {
    setError(null);
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      await post("/api/artists/update-profile-image", { imageUrl: data.url });
      setP((x) => ({ ...x, profileImage: data.url }));
      setSaved((x) => ({ ...x, profileImage: data.url }));
      toast.success("Photo updated");
      refreshUser();
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Upload failed.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (p.name.trim().length < 2) return setError("Your name needs at least 2 letters.");
    if (!p.city.trim()) return setError("Add your city.");
    setSaving(true);
    try {
      const jobs: Promise<unknown>[] = [];
      if (p.name !== saved.name) jobs.push(post("/api/artists/update-artist-name", { name: p.name.trim() }));
      if (p.city !== saved.city) jobs.push(post("/api/artists/update-city", { city: p.city.trim() }));
      if (p.bio !== saved.bio) jobs.push(post("/api/artists/update-bio", { bio: p.bio }));
      if (p.venmoHandle !== saved.venmoHandle) jobs.push(post("/api/studio/venmo", { venmoHandle: p.venmoHandle }));
      await Promise.all(jobs);
      const next = { ...p, name: p.name.trim(), city: p.city.trim(), bio: p.bio.trim() };
      setP(next);
      setSaved(next);
      toast.success("Saved");
      refreshUser();
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    try { await navigator.clipboard.writeText("https://" + link); } catch {}
    try { localStorage.setItem(SHARED_KEY, "1"); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-10">
      <div className="grid">
      <form onSubmit={save} className="grid gap-5" noValidate>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar src={p.profileImage} name={p.name || "A"} className="h-24 w-24 border-2 border-ink text-3xl" />
            {photoBusy && <span className="absolute inset-0 grid place-items-center rounded-full bg-white/80"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></span>}
          </div>
          <div className="grid gap-1.5">
            <label className="btn btn-ghost btn-sm cursor-pointer justify-self-start focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-scan">
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) changePhoto(f); e.target.value = ""; }} />
              <Camera className="h-4 w-4" aria-hidden="true" />{p.profileImage ? "Change photo" : "Add a photo"}
            </label>
            <span className="text-[12.5px] text-ink-2">A face or your studio. Square works best.</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="af-field">
            <span className="label">Artist name</span>
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} maxLength={80} required autoComplete="name" />
          </label>
          <label className="af-field">
            <span className="label">City</span>
            <input value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} maxLength={80} required autoComplete="address-level2" />
          </label>
        </div>
        <label className="af-field">
          <span className="label flex justify-between"><span>Bio</span><span className="num">{p.bio.length}/300</span></span>
          <textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value.slice(0, 300) })} rows={4} placeholder="What you paint and where. Two lines is plenty." className="resize-y" />
        </label>
        <div className="grid gap-2">
          <label className="af-field">
            <span className="label">Venmo handle · payouts setup comes later</span>
            <input value={p.venmoHandle} onChange={(e) => setP({ ...p, venmoHandle: e.target.value.replace(/\s/g, "") })} maxLength={30} placeholder="@yourname" />
          </label>
          {!saved.venmoHandle && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-sticker/40 px-3 py-2 text-[13.5px] font-semibold">
              <span className="sticker-badge text-[11px]">Heads up</span>Add your Venmo to get paid.
            </p>
          )}
        </div>

        {error && <p role="alert" className="rounded-xl border-2 border-coral bg-[#fff1ed] px-3.5 py-2.5 text-[14px] font-semibold">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-blue" disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save
          </button>
          {!dirty && !saving && <span className="flex items-center gap-1.5 text-[13px] text-ink-2"><Check className="h-4 w-4" aria-hidden="true" />All saved</span>}
        </div>
      </form>
      <DeleteAccount />
      </div>

      {/* Live preview of the public page */}
      <aside className="grid gap-3 lg:sticky lg:top-6" aria-label="Preview of your page">
        <div className="flex items-center gap-2 rounded-full border-2 border-ink bg-white py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{link}</span>
          <button type="button" onClick={copy} className="btn btn-sm shrink-0" aria-live="polite">
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border-[1.5px] border-ink bg-wall">
          <div className="relative grid justify-items-center gap-2 px-5 pb-5 pt-7 text-center">
            <Avatar src={p.profileImage} name={p.name || "A"} className="h-20 w-20 border-[3px] border-white text-2xl shadow-[0_6px_16px_rgba(21,22,27,.18)]" />
            <h2 className="display relative z-0 text-[34px]">
              <span className="relative">
                {p.name || "Your name"}
                <BrushStroke className="absolute -bottom-1 -left-2 -z-10 h-[0.45em] w-[calc(100%+16px)]" />
              </span>
            </h2>
            <span className="text-[13.5px] font-semibold text-ink-2">{p.city || "Your city"}</span>
            <p className={cn("max-w-[34ch] text-[14px]", !p.bio && "text-ink-2")}>{p.bio || "Your bio shows here."}</p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-white p-1.5">
            {art.length ? art.map((a) => (
              <span key={a.id} className="block aspect-[4/5] overflow-hidden rounded-[2px] bg-gallery">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.imageUrl} alt={a.title} className={cn("h-full w-full object-cover", a.sensitive.length > 0 && "sensitive-blur")} />
              </span>
            )) : <span className="col-span-3 py-6 text-center text-[13px] text-ink-2">Your art shows here.</span>}
          </div>
        </div>
        <Link href={`/@${slug}`} className="justify-self-start text-[13.5px] font-bold text-scan">
          Open my page <ArrowUpRight className="inline h-4 w-4" aria-hidden="true" />
        </Link>
      </aside>
    </div>
  );
}

function DeleteAccount() {
  const router = useRouter();
  const { refreshUser } = useUser();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/artists/delete-profile", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      await refreshUser();
      router.push("/");
      router.refresh();
    } catch {
      setErr("Could not delete your account. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 grid gap-3 border-t border-dashed border-line pt-5">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="justify-self-start text-[13.5px] font-semibold text-ink-2 underline-offset-2 hover:text-coral hover:underline">
          Delete my account
        </button>
      ) : (
        <div role="alertdialog" aria-labelledby="del-h" className="grid gap-3 rounded-2xl border-2 border-coral bg-[#fff6f3] p-4">
          <b id="del-h" className="font-display text-[22px] [font-variation-settings:'wdth'_80]">Delete your account?</b>
          <p className="text-[14px]">Your page, your art and your codes go away for good. Past sales stay on record.</p>
          <label className="af-field border-coral">
            <span className="label">Type DELETE to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </label>
          {err && <p role="alert" className="text-[13.5px] font-semibold text-coral">{err}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={del} disabled={typed.trim().toUpperCase() !== "DELETE" || busy} className="btn border-coral bg-coral">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Delete for good
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(""); }} className="btn btn-ghost">Keep my account</button>
          </div>
        </div>
      )}
    </div>
  );
}
