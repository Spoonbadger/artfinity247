"use client";
// The one way to tell an artist what happened after they do something.
// Every action that saves, sends, uploads or deletes calls one of these. Errors say what to do next
// and, when there's a page that fixes it, carry a button that goes there.
import { toast } from "sonner";

type Fix = { label: string; href: string };

function go(href: string) {
  if (typeof window !== "undefined") window.location.assign(href);
}

export function saved(message = "Saved", opts?: { description?: string; next?: Fix }) {
  toast.success(message, {
    description: opts?.description,
    action: opts?.next ? { label: opts.next.label, onClick: () => go(opts.next!.href) } : undefined,
  });
}

export function failed(message: string, opts?: { description?: string; fix?: Fix; retry?: () => void }) {
  toast.error(message, {
    description: opts?.description ?? (opts?.fix || opts?.retry ? undefined : "Try again. If it keeps happening, message us from Help."),
    duration: 8000,
    action: opts?.fix
      ? { label: opts.fix.label, onClick: () => go(opts.fix!.href) }
      : opts?.retry
        ? { label: "Try again", onClick: opts.retry }
        : { label: "Get help", onClick: () => go("/contact") },
  });
}

/**
 * Read an API error body into a message and, when the server names a known code, the page that fixes it.
 * Servers can return { error, code } or { message } or plain text.
 */
const FIXES: Record<string, Fix> = {
  // The "Confirm your email — Resend" bar sits at the top of every Studio page (app/studio/_lib/VerifyEmailBanner.tsx).
  email_unverified: { label: "Resend confirmation", href: "/studio#confirm-email" },
  not_logged_in: { label: "Log in", href: "/login" },
  unauthorized: { label: "Log in", href: "/login" },
  stripe_not_connected: { label: "Connect Stripe", href: "/studio/money" },
  venmo_missing: { label: "Add Venmo", href: "/studio/page#venmo" },
  infinity_required: { label: "See Infinity", href: "/studio/infinity" },
  daily_limit: { label: "See followers", href: "/studio/followers" },
  // Money, account and sign-in (Money / Account folders)
  no_sales: { label: "Print a QR code", href: "/studio/qr" },
  no_art: { label: "Add your first piece", href: "/studio/art/new" },
  no_views: { label: "Open Share kit", href: "/studio/share" },
  no_views_range: { label: "See 90 days", href: "/studio/analytics?range=90" },
  no_match: { label: "Clear filter", href: "/studio/money" },
  bad_password: { label: "Reset password", href: "/recover-password" },
  last_method: { label: "Set a password", href: "/studio/page#connected" },
  has_password: { label: "Change password", href: "/change-password" },
  account_closed: { label: "Contact us", href: "/contact" },
  account_suspended: { label: "Contact us", href: "/contact" },
  already_verified: { label: "See your seal", href: "/studio/verify" },
  venmo_taken: { label: "Message us", href: "/contact" },
  reset_expired: { label: "Send a new link", href: "/recover-password" },
  email_taken: { label: "Log in", href: "/login" },
  billing_off: { label: "Get it free", href: "/studio/infinity#referrals" },
  // Page and Audience folders
  no_followers: { label: "Add followers", href: "/studio/followers#add-followers" },
  already_sent: { label: "Start a new one", href: "/studio/newsletter" },
  art_not_found: { label: "See my art", href: "/studio/art" },
  review_not_public: { label: "How reviews work", href: "/help/growing/reviews" },
  link_limit: { label: "See my links", href: "/studio/links" },
  // Art and QR & selling folders
  image_too_small: { label: "Which files print sharp?", href: "/help/getting-started/file-sizes-print-sharp" },
  upload_limit: { label: "See my art", href: "/studio/art" },
  no_approved_art: { label: "See my art", href: "/studio/art" },
  no_art_yet: { label: "Upload art", href: "/studio/art/new" },
  edition_locked: { label: "About editions", href: "/help/selling/limited-editions" },
  collection_not_found: { label: "See collections", href: "/studio/collections" },
  collection_limit: { label: "See collections", href: "/studio/collections" },
  code_not_found: { label: "See my codes", href: "/studio/codes" },
  event_not_found: { label: "See events", href: "/studio/events" },
  event_limit: { label: "See events", href: "/studio/events" },
  not_your_art: { label: "See my art", href: "/studio/art" },
  // Print queue and mailed code orders (/studio/qr/queue)
  address_required: { label: "Add address", href: "/studio/qr/queue#ship" },
  queue_empty: { label: "Make a code", href: "/studio/qr" },
  queue_full: { label: "Open print queue", href: "/studio/qr/queue" },
  queue_item_gone: { label: "Open print queue", href: "/studio/qr/queue" },
  code_order_not_found: { label: "See my orders", href: "/studio/qr/queue#orders" },
  // Painting scans (/studio/scanning)
  scanning_off: { label: "Join the waitlist", href: "/studio/scanning#waitlist" },
  scan_not_payable: { label: "See my bookings", href: "/studio/scanning#bookings" },
  scan_not_cancellable: { label: "Message us", href: "/contact" },
  scan_not_found: { label: "See my bookings", href: "/studio/scanning#bookings" },
};

export async function problemFrom(res: Response, fallback = "Something went wrong"): Promise<{ message: string; fix?: Fix; code?: string }> {
  let message = fallback;
  let code: string | undefined;
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      message = j.error || j.message || fallback;
      code = j.code;
    } catch {
      if (text && text.length < 200) message = text;
    }
  } catch {
    // keep the fallback
  }
  if (res.status === 401 && !code) code = "unauthorized";
  return { message, fix: code ? FIXES[code] : undefined, code };
}

/** fetch + feedback in one: shows a success toast or an error toast with the fix, returns the response or null. */
export async function act(input: RequestInfo, init: RequestInit | undefined, opts: { success: string; next?: Fix; errorFallback?: string; retry?: () => void }) {
  try {
    const res = await fetch(input, init);
    if (!res.ok) {
      const p = await problemFrom(res, opts.errorFallback);
      failed(p.message, { fix: p.fix, retry: p.fix ? undefined : opts.retry });
      return null;
    }
    saved(opts.success, { next: opts.next });
    return res;
  } catch {
    failed("You seem to be offline", { description: "Check your connection and try again.", retry: opts.retry });
    return null;
  }
}

/** Words for a caught error: a dropped connection reads as "offline", anything else keeps its message. */
export function errorText(e: unknown, fallback = "Something went wrong. Try again.") {
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) return "You seem to be offline. Check your connection and try again.";
  return e instanceof Error && e.message ? e.message : fallback;
}

/**
 * Undo instead of "Are you sure?" for deletes that can be put back. Hide the thing right away (`hide`), show a toast
 * with Undo for about 6 seconds, and only then run the real delete (`commit`). Undo calls `restore` and nothing is
 * deleted. If the page is closed before the toast ends, the delete is sent then (keepalive), so nothing is lost.
 * When `commit` fails, `restore` runs and the error toast offers Try again.
 */
const pendingUndo = new Map<string, () => void>();
let undoFlushBound = false;

export function undoable(
  message: string,
  opts: { hide?: () => void; restore: () => void; commit: () => Promise<unknown>; description?: string; duration?: number; failMessage?: string },
) {
  const id = `undo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const duration = opts.duration ?? 6000;
  let settled = false;
  opts.hide?.();
  const run = async () => {
    if (settled) return;
    settled = true;
    pendingUndo.delete(id);
    clearTimeout(timer);
    try {
      await opts.commit();
    } catch (e) {
      opts.restore();
      failed(opts.failMessage ?? "That wasn't deleted", { description: errorText(e, "It's back where it was."), retry: () => undoable(message, opts) });
    }
  };
  const timer = setTimeout(run, duration);
  pendingUndo.set(id, run);
  if (!undoFlushBound && typeof window !== "undefined") {
    undoFlushBound = true;
    window.addEventListener("pagehide", () => pendingUndo.forEach((fn) => fn()));
  }
  toast(message, {
    id,
    description: opts.description,
    duration,
    action: {
      label: "Undo",
      onClick: () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        pendingUndo.delete(id);
        opts.restore();
        toast.success("Put back", { duration: 2000 });
      },
    },
  });
  return id;
}

/** For a change that's already saved and easy to reverse (taking a piece out of a collection): a toast with Undo. */
export function withUndo(message: string, undo: () => void, opts?: { description?: string; duration?: number }) {
  let done = false;
  toast(message, {
    description: opts?.description,
    duration: opts?.duration ?? 6000,
    action: {
      label: "Undo",
      onClick: () => {
        if (done) return;
        done = true;
        undo();
      },
    },
  });
}
