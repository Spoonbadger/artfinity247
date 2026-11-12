"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Camera, Check, ChevronDown, Copy, Loader2 } from "lucide-react";
import { uploadImage } from "@/components/media/uploadImage";
import { useUser } from "@/components/contexts";
import { BrushStroke } from "@/components/af/Brush";
import { Avatar } from "./StudioShell";
import { SHARED_KEY } from "./NextSteps";
import ResendConfirmButton from "./ResendConfirmButton";
import { cn } from "@/lib/utils";
import { failed, saved as savedToast } from "@/lib/feedback";
import LocationInput from "@/components/forms/LocationInput";
import { useUnsavedChanges } from "@/components/forms/useUnsavedChanges";
import AvatarCropper from "@/components/media/AvatarCropper";

type Profile = { name: string; city: string; bio: string; profileImage: string | null; venmoHandle: string };
type Art = { id: string; title: string; imageUrl: string; sensitive: string[] };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    let msg = t;
    let code: string | undefined;
    try { const j = JSON.parse(t); msg = j.error || t; code = j.code; } catch {}
    throw Object.assign(new Error(msg || "Could not save."), { code });
  }
  return res.json();
}

export default function ProfileEditor({ initial, venmoPending = null, slug, art, account, payoutDay }: { initial: Profile; venmoPending?: string | null; slug: string; art: Art[]; account?: ReactNode; /** "5th": the monthly payout day (lib/balance.ts). */ payoutDay?: string }) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [saved, setSaved] = useState(initial);
  const [p, setP] = useState(initial);
  const [photoBusy, setPhotoBusy] = useState(false);
  // A picked photo waiting in the cropper (components/media/AvatarCropper.tsx).
  const [cropping, setCropping] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Venmo waits for a confirmed email: that error gets a [Resend confirmation] button.
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // A Venmo change waiting for the artist to confirm by email ("" = removing it).
  const [pending, setPending] = useState<string | null>(venmoPending);
  const link = `theartfinity.com/@${slug}`;
  // The state of the place picked from the suggestions, sent with the city so the city page link is right.
  const pickedState = useRef<string | null>(null);
  const dirty = p.name !== saved.name || p.city !== saved.city || p.bio !== saved.bio || p.venmoHandle !== saved.venmoHandle;
  useUnsavedChanges(dirty && !saving);

  async function changePhoto(file: File) {
    setError(null);
    setPhotoBusy(true);
    try {
      const data = await uploadImage(file, { kind: "photo" });
      await post("/api/artists/update-profile-image", { imageUrl: data.url });
      setP((x) => ({ ...x, profileImage: data.url }));
      setSaved((x) => ({ ...x, profileImage: data.url }));
      toast.success("Photo updated");
      refreshUser();
      router.refresh();
    } catch (e: any) {
      const msg = e?.message && e.message !== "Failed to fetch" ? e.message : "You seem to be offline.";
      setError(msg);
      failed(`Photo not updated: ${msg}`, { description: "A JPG or PNG under 25 MB works best.", retry: () => fileRef.current?.click() });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    if (p.name.trim().length < 2) return setError("Your name needs at least 2 letters.");
    if (!p.city.trim()) return setError("Add your city.");
    setSaving(true);
    try {
      const jobs: Promise<unknown>[] = [];
      if (p.name !== saved.name) jobs.push(post("/api/artists/update-artist-name", { name: p.name.trim() }));
      if (p.city !== saved.city) jobs.push(post("/api/artists/update-city", { city: p.city.trim(), ...(pickedState.current ? { state: pickedState.current } : {}) }));
      if (p.bio !== saved.bio) jobs.push(post("/api/artists/update-bio", { bio: p.bio }));
      let venmo: { venmoHandle: string | null; pending: string | null } | null = null;
      if (p.venmoHandle !== saved.venmoHandle) jobs.push(post("/api/studio/venmo", { venmoHandle: p.venmoHandle }).then((r) => { venmo = r; }));
      await Promise.all(jobs);
      const v = venmo as { venmoHandle: string | null; pending: string | null } | null;
      // A change to an existing handle only applies after the email link is clicked.
      const venmoHandle = v ? v.venmoHandle || "" : p.venmoHandle;
      const next = { ...p, name: p.name.trim(), city: p.city.trim(), bio: p.bio.trim(), venmoHandle };
      setP(next);
      setSaved(next);
      if (v) setPending(v.pending);
      if (v?.pending != null) toast.success("Saved. Check your email to confirm the Venmo change.");
      else toast.success("Saved");
      refreshUser();
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Could not save.");
      setErrorCode(e.code || null);
      // The inline error sits by Save; the toast makes sure it's seen, with a way forward.
      const offline = !e?.message || e.message === "Failed to fetch";
      failed(offline ? "You seem to be offline" : e.message, {
        description: offline ? "Your changes are still here. Check your connection and try again." : undefined,
        fix: e.code === "email_unverified" ? { label: "Resend confirmation", href: "/studio#confirm-email" } : e.code === "not_logged_in" ? { label: "Log in", href: "/login?next=/studio/page" } : undefined,
        retry: e.code === "email_unverified" || e.code === "not_logged_in" || e.code === "invalid_input" ? undefined : () => formRef.current?.requestSubmit(),
      });
    } finally {
      setSaving(false);
    }
  }

  async function cancelVenmo() {
    try {
      const res = await fetch("/api/studio/venmo", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error();
      setPending(null);
      toast.success("Venmo change canceled");
    } catch {
      toast.error("Couldn't cancel. Try again.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText("https://" + link);
      savedToast("Link copied", { description: "Paste it in your bio, a post or a message." });
    } catch {
      failed("Couldn't copy", { description: `Your browser blocked it. Select ${link} and copy it by hand.` });
      return;
    }
    try { localStorage.setItem(SHARED_KEY, "1"); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-x-10">
      <form ref={formRef} onSubmit={save} className="grid gap-5" noValidate>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar src={p.profileImage} name={p.name || "A"} className="h-24 w-24 border-2 border-ink text-3xl" />
            {photoBusy && <span className="absolute inset-0 grid place-items-center rounded-full bg-white/80"><Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /></span>}
          </div>
          <div className="grid gap-1.5">
            <label className="btn btn-ghost btn-sm cursor-pointer justify-self-start focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-scan">
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) setCropping(f); e.target.value = ""; }} />
              <Camera className="h-4 w-4" aria-hidden="true" />{p.profileImage ? "Change photo" : "Add a photo"}
            </label>
            {cropping && (
              <AvatarCropper
                file={cropping}
                onCancel={() => setCropping(null)}
                onSave={async (f) => { setCropping(null); await changePhoto(f); }}
                onUnreadable={(f) => { setCropping(null); changePhoto(f); }}
              />
            )}
            <span className="text-[13px] text-ink-2">A face or your studio. You can crop it.</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="af-field">
            <span className="label">Artist name</span>
            <input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} maxLength={80} required autoComplete="name" />
          </label>
          <LocationInput label="City or neighborhood" name="city" scope="place" value={p.city} onChange={(v) => { setP((x) => ({ ...x, city: v })); pickedState.current = null; }} onPick={(pl) => { pickedState.current = pl.state || null; }} maxLength={80} required placeholder="Austin, TX" />
        </div>
        <label className="af-field">
          <span className="label flex justify-between"><span>Bio</span><span className="num">{p.bio.length}/300</span></span>
          <textarea value={p.bio} onChange={(e) => setP({ ...p, bio: e.target.value.slice(0, 300) })} rows={4} placeholder="What you paint and where. Two lines is plenty." className="resize-y" />
        </label>
        <div id="venmo" className="grid scroll-mt-24 gap-2">
          <label className="af-field">
            <span className="label">{payoutDay ? "Venmo for payouts" : "Venmo for payouts · private"}</span>
            <input value={p.venmoHandle} onChange={(e) => setP({ ...p, venmoHandle: e.target.value.replace(/\s/g, "") })} maxLength={30} placeholder="@yourname" aria-describedby={payoutDay ? "venmo-help" : undefined} />
          </label>
          {payoutDay && <p id="venmo-help" className="t-small">Never shown on your page. Each month&apos;s sales are paid here by the {payoutDay} of the next month.</p>}
          {pending !== null && (
            <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-[1.5px] border-sticker bg-sticker/30 px-3 py-2 text-[13.5px]">
              <b className="min-w-0 flex-1">
                {pending ? <>Waiting for you to confirm by email: {pending}</> : <>Waiting for you to confirm by email: remove your Venmo</>}
              </b>
              <button type="button" onClick={cancelVenmo} className="font-semibold text-ink-2 underline underline-offset-2 hover:text-coral">Cancel change</button>
              <span className="basis-full text-[13px] text-ink-2">The link works for 24 hours. Until then, payouts go to {saved.venmoHandle || "your current Venmo"}.</span>
            </div>
          )}
          {!saved.venmoHandle && pending === null && (
            <p role="status" className="flex items-center gap-2 rounded-xl bg-sticker/40 px-3 py-2 text-[13.5px] font-semibold">
              <span className="sticker-badge text-[12px]">Heads up</span>Add your Venmo to get paid.
            </p>
          )}
        </div>

        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-coral bg-[#fff1ed] px-3.5 py-2.5 text-[14px] font-semibold">
            <span className="min-w-0 flex-1">{error}</span>
            {errorCode === "email_unverified" && <ResendConfirmButton />}
            {errorCode === "venmo_taken" && <Link href="/contact" className="btn btn-sm shrink-0">Message us</Link>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-blue" disabled={saving || !dirty}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Save
          </button>
          {!dirty && !saving && <span className="flex items-center gap-1.5 text-[13px] text-ink-2"><Check className="h-4 w-4" aria-hidden="true" />All saved</span>}
        </div>
      </form>

      {/* Live preview of the public page: under the form on phones, beside it on desktop */}
      <aside className="grid gap-3 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1" aria-label="Preview of your page">
        <div className="flex items-center gap-2 rounded-full border-[1.5px] border-edge bg-white py-1.5 pl-4 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{link}</span>
          <button type="button" onClick={copy} className="btn btn-sm shrink-0" aria-live="polite">
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-edge bg-wall">
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
            )) : (
              <span className="col-span-3 grid justify-items-center gap-2 py-6 text-center text-[13px] text-ink-2">
                Your art shows here once a piece is approved.
                <Link href="/studio/art/new" className="btn btn-sm">Add your first piece</Link>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13.5px] font-bold [&>*]:inline-flex [&>*]:min-h-[40px] [&>*]:items-center">
          <Link href={`/@${slug}`} className="text-scan">
            Open my page <ArrowUpRight className="ml-0.5 h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/studio/design" className="text-ink-2 hover:text-ink">Colors and layout</Link>
        </div>
      </aside>

      <div className="grid min-w-0 gap-6 lg:col-start-1">
        {account && <AccountDrawer>{account}</AccountDrawer>}
        <DeleteAccount />
      </div>
    </div>
  );
}

// Private account details and sign-in methods, folded away. Links to #account-details or #connected
// (and the ?connected / ?oauth_error return from a provider) open it.
const ACCOUNT_HASHES = ["#account", "#account-details", "#connected"];

function AccountDrawer({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const open = () => {
      const q = new URLSearchParams(window.location.search);
      if (!ACCOUNT_HASHES.includes(window.location.hash) && !q.has("connected") && !q.has("oauth_error")) return;
      if (ref.current) ref.current.open = true;
      document.querySelector(window.location.hash || "#account")?.scrollIntoView({ block: "start" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return (
    <details ref={ref} id="account" className="group scroll-mt-24 border-t border-dashed border-line pt-4">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="grid">
          <b className="t-card">Account and sign-in</b>
          <span className="t-small">Legal name, email, phone, password. Never shown on your page.</span>
        </span>
        <ChevronDown className="h-5 w-5 shrink-0 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="grid gap-8 pt-2">{children}</div>
    </details>
  );
}

function DeleteAccount() {
  const { refreshUser } = useUser();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function close() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/artists/delete-profile", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "We couldn't close your account just now. Try again, or message us and we'll do it for you.");
      }
      setDone(true);
      await refreshUser();
    } catch (e: any) {
      setErr(e?.message && e.message !== "Failed to fetch" ? e.message : "Couldn't reach Artfinity. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="acct-h" className="grid gap-1">
      <h2 id="acct-h" className="sr-only">More account options</h2>
      {done ? (
        <div role="status" className="grid gap-2 rounded-2xl border border-edge bg-wall p-4">
          <b className="font-display text-[22px] [font-variation-settings:'wdth'_80]">Your account is closed.</b>
          <p className="text-[14px]">Your page is offline. You&apos;ll still be paid what you&apos;ve earned, on the normal schedule. We emailed you the details. Changed your mind? <a href="/contact" className="font-semibold underline underline-offset-2">Message us</a> and we&apos;ll reopen it.</p>
          <a href="/" className="btn btn-ghost justify-self-start">Go to the homepage</a>
        </div>
      ) : !open ? (
        <div className="grid gap-2 text-[14px] font-semibold">
          <div className="flex flex-wrap items-center gap-x-5 [&>*]:inline-flex [&>*]:min-h-[44px] [&>*]:items-center">
            <Link href="/studio/purchases" className="text-scan underline-offset-2 hover:underline">My purchases</Link>
            <Link href="/change-password" className="text-scan underline-offset-2 hover:underline">Change password</Link>
            <Link href="/studio/verify" className="text-scan underline-offset-2 hover:underline">Verification</Link>
            <Link href="/studio/infinity" className="text-scan underline-offset-2 hover:underline">My plan</Link>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-[44px] w-fit items-center text-ink-2 underline-offset-2 hover:text-coral hover:underline">
            Close my account
          </button>
        </div>
      ) : (
        <div role="alertdialog" aria-labelledby="del-h" className="grid gap-3 rounded-2xl border-2 border-coral bg-[#fff6f3] p-4">
          <b id="del-h" className="font-display text-[22px] [font-variation-settings:'wdth'_80]">Close your account?</b>
          <p className="text-[14px]">Your page goes offline right away. You&apos;ll still be paid what you&apos;ve earned.</p>
          <ul className="grid list-disc gap-1 pl-5 text-[13.5px] text-ink-2">
            <li>Your art and codes stop showing to buyers.</li>
            <li>Unpaid earnings go to your Venmo on the usual monthly payout.</li>
            <li>Past sales stay on record. Contact us if you want to reopen.</li>
          </ul>
          <label className="af-field border-coral">
            <span className="label">Type CLOSE to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
          </label>
          {err && (
            <p role="alert" className="text-[13.5px] font-semibold text-coral">
              {err} <Link href="/contact" className="text-ink underline underline-offset-2">Message us</Link>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={close} disabled={typed.trim().toUpperCase() !== "CLOSE" || busy} className="btn border-coral bg-coral">
              {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}Close my account
            </button>
            <button type="button" onClick={() => { setOpen(false); setTyped(""); }} className="btn btn-ghost">Keep my account</button>
          </div>
        </div>
      )}
    </section>
  );
}
