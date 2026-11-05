"use client";

import { CSSProperties, FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useUser } from "@/components/contexts";
import { cn } from "@/lib/utils";

// This browser only remembers the button state; the real list lives in the database (Follower).
export type FollowState = "none" | "pending" | "on";
const key = (handle: string) => `af:follows:${handle.toLowerCase()}`;
const EVENT = "af-follow";

export function readFollow(handle: string): FollowState {
  try {
    const v = localStorage.getItem(key(handle));
    return v === "on" ? "on" : v === "pending" ? "pending" : "none";
  } catch {
    return "none";
  }
}

export function rememberFollow(handle: string, state: FollowState) {
  try {
    if (state === "none") localStorage.removeItem(key(handle));
    else localStorage.setItem(key(handle), state);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: handle.toLowerCase() }));
}

/** Follow state for one artist, kept in sync across buttons on the page. */
export function useFollowState(handle: string) {
  const [state, setState] = useState<FollowState>("none");
  useEffect(() => {
    const sync = () => setState(readFollow(handle));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [handle]);
  return state;
}

export const followLabel = (state: FollowState, idle: string) => (state === "on" ? "Following ✓" : state === "pending" ? "Check your email" : idle);

/** The small sheet: email field, Follow, then "check your email". Bottom sheet on phones, card on desktop. */
export function FollowSheet({ handle, firstName, source = "page", open, onClose }: { handle: string; firstName: string; source?: "page" | "links"; open: boolean; onClose: () => void }) {
  const { currentUser } = useUser();
  const state = useFollowState(handle);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentUser?.email) setEmail((e) => e || currentUser.email);
  }, [currentUser?.email]);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setEditing(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const website = (new FormData(e.currentTarget).get("website") as string) || "";
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, email: email.trim(), source, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
      rememberFollow(handle, data.state === "following" ? "on" : "pending");
      setSentTo(data.state === "following" ? null : email.trim());
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") return null;
  const showForm = state === "none" || editing;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="follow-title"
        className="relative w-full rounded-t-[22px] border-[1.5px] border-ink bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-left font-body text-ink shadow-[0_-12px_40px_-12px_rgba(21,22,27,.35)] sm:max-w-[400px] sm:rounded-2xl sm:pb-5 sm:shadow-[6px_6px_0_#15161b]"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <span className="paint-dab mb-2 h-3 w-6" style={{ ["--dab" as string]: "var(--accent, var(--af-scan))" }} aria-hidden />

        {showForm ? (
          <form onSubmit={submit} className="grid gap-3">
            <h2 id="follow-title" className="display pr-10 text-[28px] leading-[1.05]">Get new work from {firstName} by email</h2>
            <label className="af-field">
              <span className="label">Your email</span>
              <input ref={input} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            {/* honeypot: hidden from people, bots fill it */}
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
            {error && <p role="alert" className="text-[14px] font-semibold text-coral">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-blue w-full py-3 text-[16px]">{busy ? "Sending…" : "Follow"}</button>
            <p className="text-center text-[12.5px] text-ink-2">We&apos;ll email you a link to confirm. Unsubscribe anytime.</p>
          </form>
        ) : state === "pending" ? (
          <div className="grid gap-3" aria-live="polite">
            <h2 id="follow-title" className="display pr-10 text-[28px] leading-[1.05]">Check your email</h2>
            <p className="text-[15px] text-ink-2">
              We sent a link{sentTo ? <> to <b className="text-ink">{sentTo}</b></> : null}. Tap it and {firstName}&apos;s new work comes straight to you.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onClose} className="btn btn-blue btn-sm min-h-[44px] px-5">Done</button>
              <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost btn-sm min-h-[44px] px-5">Use another email</button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3" aria-live="polite">
            <h2 id="follow-title" className="display pr-10 text-[28px] leading-[1.05]">You follow {firstName} ✓</h2>
            <p className="text-[15px] text-ink-2">New work lands in your inbox. Every email has a one-tap unsubscribe.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onClose} className="btn btn-blue btn-sm min-h-[44px] px-5">Done</button>
              <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost btn-sm min-h-[44px] px-5">Use another email</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Follow button + sheet. Pass classes for each look; the label switches to "Check your email" / "Following ✓". */
export default function FollowButton({
  handle,
  firstName,
  label = "Follow",
  source = "page",
  className,
  idleClassName,
  doneClassName,
  idleStyle,
  children,
}: {
  handle: string;
  firstName: string;
  label?: string;
  source?: "page" | "links";
  className?: string;
  idleClassName?: string;
  doneClassName?: string;
  idleStyle?: CSSProperties;
  children?: ReactNode;
}) {
  const state = useFollowState(handle);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const idle = state === "none";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-pressed={state === "on"}
        className={cn(className, idle ? idleClassName : doneClassName)}
        style={idle ? idleStyle : undefined}
      >
        {children ?? followLabel(state, label)}
      </button>
      <FollowSheet handle={handle} firstName={firstName} source={source} open={open} onClose={close} />
    </>
  );
}
