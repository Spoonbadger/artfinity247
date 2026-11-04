"use client";

import { ChangeEvent, DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Brushed, BrushStroke } from "@/components/af/Brush";
import QRCode from "@/components/af/QRCode";
import { useUser } from "@/components/contexts";
import { scanUrl } from "@/lib/qr/render";
import { cn } from "@/lib/utils";
import { AuthCard, Field, FormAlert, PasswordField, Spinner } from "./ui";
import { safeNext, withNext } from "./next";

const HANDLE_RE = /^[a-z0-9_.]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SIZES = [
  { key: "small", short: "S" },
  { key: "medium", short: "M" },
  { key: "large", short: "L" },
  { key: "xl", short: "XL" },
] as const;
const SENSITIVE = ["Nudity", "Violence or gore", "Disturbing imagery", "Drug use", "Strong language"];

type Step = 1 | 2 | 3 | 4;
type HandleState = { status: "idle" | "checking" | "ok" | "bad"; message?: string; suggestions?: string[] };
type Upload = { preview: string; url?: string; width?: number; height?: number; printable?: string[]; uploading: boolean; error?: string };

const cleanHandle = (v: string) => v.toLowerCase().replace(/^@/, "").replace(/[^a-z0-9_.]/g, "").slice(0, 30);

/** Ask the shared handle route first; fall back to our own if it isn't there yet. */
async function lookupHandle(h: string, email?: string): Promise<{ available: boolean; reason?: string; suggestions?: string[]; emailInUse?: boolean }> {
  if (!email) {
    try {
      const r = await fetch(`/api/handles/check?h=${encodeURIComponent(h)}`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        // That route normalizes differently (it allows hyphens), so only trust it for the exact handle we asked about.
        if (typeof d?.available === "boolean" && d.handle === h) {
          const sugg: string[] = d.suggestions ?? (d.suggestion ? [d.suggestion] : []);
          return { available: d.available, reason: d.reason === "short" ? "invalid" : d.reason, suggestions: sugg.filter((x) => HANDLE_RE.test(x)) };
        }
      }
    } catch {}
  }
  const q = new URLSearchParams({ h });
  if (email) q.set("email", email);
  const r = await fetch(`/api/auth/handle-available?${q}`, { cache: "no-store" });
  return r.json();
}

function handleMessage(reason?: string) {
  if (reason === "invalid") return "Use 3 to 30 letters, numbers, dots or underscores.";
  if (reason === "reserved") return "That name is reserved.";
  return "That name is taken.";
}

export default function RegisterFlow() {
  const params = useSearchParams();
  const { currentUser, refreshUser } = useUser();
  const next = safeNext(params.get("next"));
  // Referral code from /register?ref=CODE, passed through to the account (see lib/referrals.ts).
  const ref = (params.get("ref") || "").trim().slice(0, 24) || undefined;
  const home = next || "/studio";
  const [step, setStep] = useState<Step>(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // step 1
  const [handle, setHandle] = useState(() => cleanHandle(params.get("handle") || ""));
  const [hs, setHs] = useState<HandleState>({ status: "idle" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  // step 2
  const [artistName, setArtistName] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [created, setCreated] = useState(false);
  // step 3
  const [upload, setUpload] = useState<Upload | null>(null);
  const [title, setTitle] = useState("");
  const [isSensitive, setIsSensitive] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // step 4
  const [artwork, setArtwork] = useState<{ slug: string; title: string } | null>(null);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Live handle check, debounced.
  useEffect(() => {
    if (created) return;
    if (!handle) return setHs({ status: "idle" });
    if (handle.length < 3) return setHs({ status: "bad", message: "At least 3 characters." });
    if (!HANDLE_RE.test(handle)) return setHs({ status: "bad", message: handleMessage("invalid") });
    setHs({ status: "checking" });
    let live = true;
    const t = setTimeout(async () => {
      try {
        const d = await lookupHandle(handle);
        if (!live) return;
        setHs(d.available ? { status: "ok", message: "That name is yours." } : { status: "bad", message: handleMessage(d.reason), suggestions: d.suggestions });
      } catch {
        if (live) setHs({ status: "idle" });
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [handle, created]);

  const go = useCallback((n: Step) => {
    setFormError(null);
    setStep(n);
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      headingRef.current?.focus({ preventScroll: true });
    });
  }, []);

  // ---------- step 1: handle, email, password ----------
  async function submitStep1(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string | null> = {};
    if (!HANDLE_RE.test(handle)) errs.handle = handle ? handleMessage("invalid") : "Pick the name people will find you by.";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a real email. We send sales there.";
    if (password.length < 8) errs.password = "Use at least 8 characters.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    try {
      const d = await lookupHandle(handle, email.trim());
      if (!d.available) {
        setHs({ status: "bad", message: handleMessage(d.reason), suggestions: d.suggestions });
        setErrors({ handle: " " });
        return;
      }
      if (d.emailInUse) {
        setErrors({ email: "That email already has a page." });
        return;
      }
      go(2);
    } catch {
      go(2); // the check is a nicety; the server validates again on create
    } finally {
      setBusy(false);
    }
  }

  // ---------- step 2: name + city, then create the account ----------
  async function submitStep2(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string | null> = {};
    if (!artistName.trim()) errs.artistName = "Add the name buyers will see.";
    if (!city.trim()) errs.city = "Add your city.";
    if (!agreed) errs.terms = "Please accept the Artist Terms and the Terms & Conditions.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, email: email.trim().toLowerCase(), password, artist_name: artistName.trim(), city: city.trim(), state: region.trim(), acceptedTerms: agreed, ref }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (d.code === "handle_taken" || d.code === "invalid_handle") {
          setHs({ status: "bad", message: handleMessage(d.code === "invalid_handle" ? "invalid" : "taken"), suggestions: d.suggestions });
          go(1);
          setErrors({ handle: " " });
        } else if (d.code === "email_taken") {
          go(1);
          setErrors({ email: "That email already has a page." });
        } else if (d.code === "weak_password") {
          go(1);
          setErrors({ password: "Use at least 8 characters." });
        } else if (d.code === "terms_required") {
          setErrors({ terms: "Please accept the Artist Terms and the Terms & Conditions." });
        } else {
          setFormError("Couldn't create your page. Try again in a moment.");
        }
        return;
      }
      setCreated(true);
      await refreshUser();
      go(3);
    } catch {
      setFormError("Couldn't reach Artfinity. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  // ---------- step 3: first piece ----------
  async function takeFile(file: File | undefined | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUpload({ preview: "", uploading: false, error: "That isn't an image. Try a JPG or PNG." });
      return;
    }
    if (upload?.preview) URL.revokeObjectURL(upload.preview);
    const preview = URL.createObjectURL(file);
    setUpload({ preview, uploading: true });
    if (!title) setTitle(prettyTitle(file.name));
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Upload failed. Try again.");
      setUpload({ preview, uploading: false, url: d.url, width: d.width, height: d.height, printable: d.printable || [] });
    } catch (err: any) {
      setUpload({ preview, uploading: false, error: err.message || "Upload failed. Try again." });
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    takeFile(e.dataTransfer.files?.[0]);
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!upload?.url) return;
    if (!title.trim()) return setErrors({ title: "Give it a title." });
    if (isSensitive && labels.length === 0) return setErrors({ sensitive: "Pick at least one." });
    setErrors({});
    setBusy(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("title", title.trim());
      fd.append("description", "");
      fd.append("imageUrl", upload.url);
      for (const k of ["markupSmall", "markupMedium", "markupLarge", "markupXl"]) fd.append(k, "0");
      fd.append("sensitive", isSensitive ? labels.join(",") : "");
      const res = await fetch("/api/artworks/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error(res.status === 429 ? "Too many uploads right now. Wait a minute." : "Couldn't publish it. Try again.");
      const d = await res.json();
      setArtwork({ slug: d.slug, title: d.title });
      go(4);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const printable = upload?.printable || [];
  const printNote = !upload?.url
    ? null
    : printable.length === 4
      ? "Sharp at every size, up to 18 × 24 in."
      : printable.length === 0
        ? "Too small to print well. Try the original photo."
        : (() => {
          const missing = SIZES.filter((s) => !printable.includes(s.key)).map((s) => s.short);
          return `${missing.join(", ")} ${missing.length > 1 ? "need" : "needs"} a bigger file.`;
        })();

  const shownName = artistName.trim() || "Your name";
  const shownCity = [city.trim(), region.trim()].filter(Boolean).join(", ");

  return (
    <div className="mx-auto grid max-w-[1120px] items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
      <AuthCard className="grid gap-6">
        <div className="flex gap-1.5" role="progressbar" aria-label="Sign-up progress" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step}>
          {[1, 2, 3, 4].map((n) => (
            <i key={n} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", n <= step ? "bg-scan" : "bg-line")} />
          ))}
        </div>

        {currentUser && !created && step === 1 && (
          <FormAlert tone="ok">
            You're logged in{currentUser.slug ? ` as @${currentUser.slug}` : ""}.{" "}
            <Link href={home} className="underline underline-offset-4">Go to your Studio</Link>
          </FormAlert>
        )}

        {step === 1 && (
          <form onSubmit={submitStep1} className="grid gap-5" noValidate>
            <StepHead n={1} refEl={headingRef}>
              Claim your <Brushed>page</Brushed>
            </StepHead>
            <div className="grid gap-1.5">
              <Field
                label="Your link"
                prefix={<span className="text-[15px] sm:text-[17px]">theartfinity.com/@</span>}
                name="handle"
                value={handle}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setHandle(cleanHandle(e.target.value));
                  setErrors((x) => ({ ...x, handle: null }));
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="username"
                maxLength={30}
                placeholder="yourname"
                className="[&_input]:font-semibold"
                error={errors.handle && errors.handle.trim() ? errors.handle : null}
                autoFocus={!handle}
              />
              <HandleStatus hs={hs} onPick={(s) => setHandle(s)} />
            </div>
            <Field label="Email" type="email" name="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((x) => ({ ...x, email: null })); }} error={errors.email} autoFocus={!!handle} />
            {errors.email === "That email already has a page." && (
              <p className="-mt-3 px-1 text-[14px]">
                <Link href={withNext("/login", next, { email: email.trim() })} className="font-bold text-scan underline underline-offset-4">Log in instead</Link>
              </p>
            )}
            <PasswordField label="Password" name="password" autoComplete="new-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: null })); }} error={errors.password} hint="8 or more characters" />
            <button type="submit" className="btn btn-blue btn-lg w-full" disabled={busy}>
              {busy && <Spinner />}
              Continue
            </button>
            <p className="text-center text-[14px] text-ink-2">Free. No card. About a minute.</p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitStep2} className="grid gap-5" noValidate>
            <StepHead n={2} refEl={headingRef}>What should buyers call you?</StepHead>
            <FormAlert>{formError}</FormAlert>
            <Field label="Artist name" name="artist_name" autoComplete="name" maxLength={60} value={artistName} onChange={(e) => { setArtistName(e.target.value); setErrors((x) => ({ ...x, artistName: null })); }} error={errors.artistName} autoFocus placeholder="Maya Okafor" />
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <Field label="City" name="city" autoComplete="address-level2" maxLength={60} value={city} onChange={(e) => { setCity(e.target.value); setErrors((x) => ({ ...x, city: null })); }} error={errors.city} placeholder="Asheville" />
              <Field label="State (optional)" name="state" autoComplete="address-level1" maxLength={40} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="NC" />
            </div>
            <p className="-mt-1 text-[14px] text-ink-2">Your city puts you on the local map.</p>
            <div className="grid gap-1.5">
              <label htmlFor="accept-terms" className="flex cursor-pointer items-start gap-3 text-[15px] leading-snug">
                <input
                  id="accept-terms"
                  name="acceptedTerms"
                  type="checkbox"
                  required
                  checked={agreed}
                  onChange={(e) => { setAgreed(e.target.checked); setErrors((x) => ({ ...x, terms: null })); }}
                  aria-invalid={!!errors.terms}
                  aria-describedby={errors.terms ? "accept-terms-error" : undefined}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--af-scan)]"
                />
                <span>
                  I agree to the{" "}
                  <Link href="/artist-terms-and-agreement" target="_blank" className="font-semibold text-scan underline underline-offset-4">Artist Terms</Link>{" "}
                  and the{" "}
                  <Link href="/terms-and-conditions" target="_blank" className="font-semibold text-scan underline underline-offset-4">Terms &amp; Conditions</Link>.
                </span>
              </label>
              {errors.terms && <p id="accept-terms-error" role="alert" className="pl-8 text-[14px] font-semibold text-coral">{errors.terms}</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => go(1)} disabled={busy}>Back</button>
              <button type="submit" className="btn btn-blue btn-lg flex-1" disabled={busy}>
                {busy && <Spinner />}
                {busy ? "Making your page" : "Create my page"}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={publish} className="grid gap-5" noValidate>
            <StepHead n={3} refEl={headingRef}>Add your first piece</StepHead>
            <FormAlert>{formError}</FormAlert>
            <input ref={fileRef} id="art-file" type="file" accept="image/*" className="sr-only" onChange={(e) => takeFile(e.target.files?.[0])} />
            {!upload?.preview ? (
              <label
                htmlFor="art-file"
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "grid cursor-pointer justify-items-center gap-2 rounded-[18px] border-[2.5px] border-dashed px-5 py-10 text-center transition focus-within:border-scan",
                  dragging ? "border-scan bg-scan-soft" : "border-ink-2 hover:border-ink hover:bg-wall",
                )}
              >
                <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 15v5h16v-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <b className="text-[17px]">Drop a photo of your painting</b>
                <span className="text-[14px] text-ink-2">JPG or PNG. A phone photo is fine.</span>
                <span className="btn btn-blue btn-sm mt-2">Choose a photo</span>
                {upload?.error && <span className="mt-1 text-[14px] font-semibold text-coral" role="alert">{upload.error}</span>}
              </label>
            ) : (
              <div
                className={cn("grid gap-5 rounded-[18px] border-[2.5px] border-dashed p-4 sm:grid-cols-[200px_minmax(0,1fr)] sm:p-5", dragging ? "border-scan bg-scan-soft" : "border-line")}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <div className="grid content-start gap-2">
                  <div className="relative mx-auto w-fit max-w-[220px] overflow-hidden rounded-md bg-wall shadow-[0_8px_20px_rgba(21,22,27,.18)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={upload.preview} alt={title || "Your artwork"} className={cn("block h-auto max-h-[30svh] w-auto max-w-full sm:max-h-none sm:w-full", upload.uploading && "opacity-60")} />
                    {upload.uploading && (
                      <span className="absolute inset-0 grid place-items-center">
                        <span className="flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[13.5px] font-bold"><Spinner /> Uploading</span>
                      </span>
                    )}
                  </div>
                  <button type="button" onClick={() => fileRef.current?.click()} className="min-h-[44px] text-[14px] font-semibold text-ink-2 underline underline-offset-4 hover:text-scan">
                    Use a different photo
                  </button>
                </div>
                <div className="grid content-start gap-4">
                  {upload.error && <FormAlert>{upload.error}</FormAlert>}
                  <Field label="Title" name="title" maxLength={80} value={title} onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: null })); }} error={errors.title} placeholder="Blue Ridge, Late" />
                  <div className="grid gap-2" aria-live="polite">
                    <span className="text-[13px] font-semibold text-ink-2">{upload.url ? "Prints sharp at" : "Checking print sizes"}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {SIZES.map((s) => {
                        const ok = printable.includes(s.key);
                        return (
                          <span
                            key={s.key}
                            className={cn(
                              "min-w-[42px] rounded-full border-[1.5px] px-3 py-1 text-center text-[13.5px] font-bold",
                              !upload.url ? "border-line text-ink-2" : ok ? "border-ink bg-paper text-ink" : "border-dashed border-line text-ink-2 line-through",
                            )}
                          >
                            {s.short}
                            <span className="sr-only">{upload.url ? (ok ? " ready" : " needs a bigger file") : ""}</span>
                          </span>
                        );
                      })}
                    </div>
                    {printNote && <span className="text-[13.5px] text-ink-2">{printNote}</span>}
                  </div>
                  <div className="grid gap-2">
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 text-[14.5px] font-semibold">
                      <input type="checkbox" checked={isSensitive} onChange={(e) => { setIsSensitive(e.target.checked); setErrors((x) => ({ ...x, sensitive: null })); }} className="h-[18px] w-[18px] accent-[var(--af-scan)]" />
                      Contains sensitive content
                    </label>
                    {isSensitive && (
                      <fieldset className="grid gap-2 pl-[26px]">
                        <legend className="sr-only">What kind?</legend>
                        <div className="flex flex-wrap gap-1.5">
                          {SENSITIVE.map((l) => {
                            const on = labels.includes(l);
                            return (
                              <label key={l} className={cn("inline-flex min-h-[44px] cursor-pointer items-center rounded-full border-[1.5px] px-4 py-1 text-[14px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-scan", on ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink hover:border-ink")}>
                                <input type="checkbox" className="sr-only" checked={on} onChange={() => { setLabels((xs) => (on ? xs.filter((x) => x !== l) : [...xs, l])); setErrors((x) => ({ ...x, sensitive: null })); }} />
                                {on && <span aria-hidden="true">✓ </span>}
                                {l}
                              </label>
                            );
                          })}
                        </div>
                        <span className={cn("text-[13px]", errors.sensitive ? "font-semibold text-coral" : "text-ink-2")}>{errors.sensitive || "It stays blurred until a viewer chooses to look."}</span>
                      </fieldset>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Phones: once a photo is in, Publish stays pinned to the bottom while you fill in the rest */}
            <div className={cn("flex flex-wrap items-center justify-between gap-3", upload?.preview && "max-sm:sticky max-sm:bottom-0 max-sm:z-10 max-sm:-mx-6 max-sm:-mb-6 max-sm:flex-col-reverse max-sm:gap-1 max-sm:rounded-b-[20px] max-sm:border-t max-sm:border-line max-sm:bg-paper/95 max-sm:px-6 max-sm:pb-[calc(12px+env(safe-area-inset-bottom))] max-sm:pt-3 max-sm:backdrop-blur")}>
              <button type="button" className="min-h-[44px] text-[15px] font-semibold text-ink-2 underline underline-offset-4 hover:text-scan" onClick={() => go(4)} disabled={busy}>
                Skip for now
              </button>
              <button type="submit" className="btn btn-blue btn-lg max-sm:w-full" disabled={busy || !upload?.url || upload.uploading}>
                {busy && <Spinner />}
                Publish and make my code
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <div className="grid gap-5">
            <StepHead n={4} refEl={headingRef}>
              {artwork ? <>Your code is <Brushed>live</Brushed></> : <>Your page is <Brushed>live</Brushed></>}
            </StepHead>
            {artwork ? (
              <div className="grid items-center gap-6 sm:grid-cols-[220px_minmax(0,1fr)]">
                <div className="mx-auto w-full max-w-[240px] rounded-[18px] border-2 border-ink bg-white p-3.5">
                  <QRCode value={scanUrl(artwork.slug)} dots="rounded" eyes="frame" eyeColor="#2b37f0" />
                  <span className="mt-2 block text-center text-[13px] font-bold">Scan to buy a print</span>
                </div>
                <div className="grid gap-3">
                  <p className="text-[16px] text-ink-2">
                    Point your phone at it. It opens <b className="text-ink">{artwork.title}</b> with sizes and a buy button.
                  </p>
                  <Link href={`/studio/qr?art=${encodeURIComponent(artwork.slug)}`} className="btn btn-blue btn-lg">Style and print it</Link>
                  <Link href={home} className="btn btn-ghost btn-lg">Go to my Studio</Link>
                  <p className="text-[13.5px] text-ink-2">We'll ask where to send your money after your first sale.</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="text-[16px] text-ink-2">
                  You're at <b className="text-ink">theartfinity.com/@{handle}</b>. Add a piece and its code is ready to print.
                </p>
                <Link href="/studio/art/new" className="btn btn-blue btn-lg">Add your first piece</Link>
                <Link href={home} className="btn btn-ghost btn-lg">Go to my Studio</Link>
              </div>
            )}
          </div>
        )}
      </AuthCard>

      <PagePreview name={shownName} city={shownCity} handle={handle} image={upload?.preview || null} imageAlt={title} />
    </div>
  );
}

function StepHead({ n, refEl, children }: { n: Step; refEl: React.RefObject<HTMLHeadingElement>; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <span className="eyebrow">{n === 4 ? "Done" : `Step ${n} of 4`}</span>
      <h1 ref={refEl} tabIndex={-1} className="display text-[clamp(38px,4.6vw,56px)] outline-none">
        {children}
      </h1>
    </div>
  );
}

function HandleStatus({ hs, onPick }: { hs: HandleState; onPick: (s: string) => void }) {
  if (hs.status === "idle") return <div className="px-1 text-[13.5px] text-ink-2">Letters, numbers, dots or underscores.</div>;
  if (hs.status === "checking") return <div className="flex items-center gap-2 px-1 text-[13.5px] text-ink-2" aria-live="polite"><Spinner className="h-3 w-3" /> Checking</div>;
  if (hs.status === "ok")
    return (
      <div className="px-1 text-[13.5px] font-semibold text-earned" aria-live="polite">
        <span aria-hidden="true">✓ </span>
        {hs.message}
      </div>
    );
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[13.5px]" aria-live="polite">
      <span className="font-semibold text-coral">{hs.message}</span>
      {hs.suggestions?.length ? (
        <>
          <span className="text-ink-2">Try</span>
          {hs.suggestions.map((s) => (
            <button key={s} type="button" onClick={() => onPick(s)} className="rounded-full border-[1.5px] border-ink px-2.5 py-0.5 font-semibold hover:bg-ink hover:text-white">
              @{s}
            </button>
          ))}
        </>
      ) : null}
    </div>
  );
}

const PLACEHOLDER = ["#c9b8a3", "#a9b7a8", "#d8c7a8"];

/** The artist's public page, filling in as they type. */
function PagePreview({ name, city, handle, image, imageAlt }: { name: string; city: string; handle: string; image: string | null; imageAlt: string }) {
  const initial = (name.trim()[0] || "?").toUpperCase();
  return (
    <aside className="grid gap-2.5 lg:sticky lg:top-8" aria-label="Live preview of your page">
      <span className="text-[13px] font-semibold text-ink-2">Your page, live preview</span>
      <div className="overflow-hidden rounded-[18px] border-[1.5px] border-line bg-paper shadow-[0_16px_40px_rgba(21,22,27,.1)]">
        <div className="relative h-[92px] overflow-hidden bg-gallery">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" className="h-full w-full object-cover" />
          ) : (
            <>
              <BrushStroke className="absolute -left-4 top-3 h-10 w-[70%]" color="#d6c6ad" />
              <BrushStroke className="absolute right-[-10%] top-10 h-12 w-[80%] -scale-x-100" color="#c7cfc2" />
            </>
          )}
        </div>
        <div className="grid gap-0.5 px-[18px] pb-5">
          <div className="relative -mt-9 grid h-[70px] w-[70px] place-items-center rounded-full border-[3px] border-paper bg-sticker font-display text-[30px] font-extrabold text-ink">
            {initial}
          </div>
          <b className="display mt-1.5 text-[28px] [overflow-wrap:anywhere]">{name}</b>
          {city && <span className="text-[14px] text-ink-2">{city}</span>}
          <span className="text-[14px] font-semibold text-scan [overflow-wrap:anywhere]">theartfinity.com/@{handle || "yourname"}</span>
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) =>
              i === 0 && image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={image} alt={imageAlt || "Your artwork"} className="aspect-[4/5] w-full rounded object-cover" />
              ) : (
                <i key={i} className="relative block aspect-[4/5] overflow-hidden rounded bg-wall">
                  <span className="absolute left-1/2 top-1/2 h-9 w-12 -translate-x-1/2 -translate-y-1/2 opacity-70" style={{ background: PLACEHOLDER[i], borderRadius: "52% 44% 58% 40%", rotate: `${[-14, 10, -4][i]}deg` }} />
                </i>
              ),
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function prettyTitle(filename: string) {
  const base = filename.replace(/\.[a-z0-9]+$/i, "");
  // Camera names like IMG_2034 or PXL_2024... make poor titles.
  if (/^(img|pxl|dsc|dscn|photo|image|screenshot)[\s_-]?\d/i.test(base) || /^\d+$/.test(base)) return "";
  const t = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}
