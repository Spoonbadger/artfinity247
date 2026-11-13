"use client";

// The wishlist heart on painting pages and artwork cards. Signed-in collectors save with one tap; anyone else gets a
// small email sheet ("Save it to your collection — we'll email you a link"), and the piece is saved when they open it.
// One shared fetch per page load tells every heart what's saved (no provider needed).
import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/lib/a11y/useFocusTrap";

type State = { loaded: boolean; signedIn: boolean; ids: Set<string> };
let state: State = { loaded: false, signedIn: false, ids: new Set() };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const SERVER: State = { loaded: false, signedIn: false, ids: new Set() };

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
}

function load() {
  if (!loading) {
    loading = fetch("/api/collector/wishlist", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { signedIn: false, ids: [] }))
      .then((d: { signedIn?: boolean; ids?: string[] }) => set({ loaded: true, signedIn: !!d.signedIn, ids: new Set(d.ids || []) }))
      .catch(() => set({ loaded: true }));
  }
  return loading;
}

function useWishlist() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => SERVER,
  );
  useEffect(() => {
    load();
  }, []);
  return s;
}

export default function WishlistHeart({ artworkId, title, variant = "card", className }: { artworkId: string; title: string; variant?: "card" | "inline"; className?: string }) {
  const s = useWishlist();
  const saved = s.ids.has(artworkId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    await load();
    if (!state.signedIn) {
      setOpen(true);
      return;
    }
    const was = state.ids.has(artworkId);
    const ids = new Set(state.ids);
    if (was) ids.delete(artworkId);
    else ids.add(artworkId);
    set({ ids });
    setBusy(true);
    try {
      const r = await fetch("/api/collector/wishlist", { method: was ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ artworkId }) });
      if (r.status === 401) {
        set({ signedIn: false, ids: new Set() });
        setOpen(true);
        return;
      }
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Couldn't save it.");
      if (!was) toast.success("Saved to your collection", { action: { label: "View", onClick: () => (window.location.href = "/collector#wishlist") } });
    } catch (e) {
      const back = new Set(state.ids);
      if (was) back.add(artworkId);
      else back.delete(artworkId);
      set({ ids: back });
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        aria-pressed={saved}
        aria-label={saved ? `Saved: remove ${title} from your collection` : `Save ${title} to your collection`}
        title={saved ? "Saved to your collection" : "Save to your collection"}
        className={cn(
          "grid shrink-0 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-scan",
          variant === "card"
            ? "h-10 w-10 bg-white/90 text-ink shadow-[0_2px_8px_-2px_rgba(21,22,27,.35)] backdrop-blur hover:bg-white"
            : "h-11 w-11 border-[1.5px] border-line bg-white text-ink hover:border-ink",
          className,
        )}
      >
        <Heart className={cn("h-5 w-5 transition", saved && "fill-[rgb(var(--af-coral-rgb))] text-[rgb(var(--af-coral-rgb))]")} strokeWidth={2.2} aria-hidden />
      </button>
      <SaveSheet open={open} onClose={() => setOpen(false)} artworkId={artworkId} title={title} />
    </>
  );
}

/** "Save it to your collection — we'll email you a link." Bottom sheet on phones, card on desktop. */
function SaveSheet({ open, onClose, artworkId, title }: { open: boolean; onClose: () => void; artworkId: string; title: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useFocusTrap(sheet, open);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setError(null);
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
      const r = await fetch("/api/collector/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), save: artworkId, next: window.location.pathname, website }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "Something went wrong. Try again.");
      setSent(email.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/40 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-title"
        className="relative w-full rounded-t-[22px] border-[1.5px] border-ink bg-white px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-left font-body text-ink shadow-[0_-12px_40px_-12px_rgba(21,22,27,.35)] sm:max-w-[400px] sm:rounded-2xl sm:pb-5 sm:shadow-[6px_6px_0_#15161b]"
      >
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full text-ink-2 hover:bg-wall hover:text-ink">
          <X className="h-5 w-5" aria-hidden />
        </button>
        <span className="paint-dab mb-2 h-3 w-6" style={{ ["--dab" as string]: "var(--af-coral)" }} aria-hidden />
        {sent ? (
          <div className="grid gap-3" aria-live="polite">
            <h2 id="save-title" className="display pr-10 text-[28px] leading-[1.05]">Check your email</h2>
            <p className="text-[15px] text-ink-2">
              We sent a link to <b className="text-ink">{sent}</b>. Tap it within 15 minutes and <b className="text-ink">{title}</b> is saved to your collection.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onClose} className="btn btn-blue btn-sm min-h-[44px] px-5">Done</button>
              <button type="button" onClick={() => setSent(null)} className="btn btn-ghost btn-sm min-h-[44px] px-5">Use another email</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-3">
            <h2 id="save-title" className="display pr-10 text-[28px] leading-[1.05]">Save it to your collection</h2>
            <p className="-mt-1 text-[15px] text-ink-2">We&apos;ll email you a link. No password, and you never need an account to buy.</p>
            <label className="af-field">
              <span className="label">Your email</span>
              <input ref={input} type="email" required autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute left-[-9999px] h-px w-px opacity-0" />
            {error && <p role="alert" className="text-[14px] font-semibold text-coral">{error}</p>}
            <button type="submit" disabled={busy} className="btn btn-blue w-full py-3 text-[16px]">{busy ? "Sending…" : "Email me a link"}</button>
            <p className="text-center text-[13px] text-ink-2">
              Your collection keeps your orders, wishlist and followed artists. <Link href="/help/buyers/orders-and-wishlist" className="underline underline-offset-2">How it works</Link>
            </p>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
