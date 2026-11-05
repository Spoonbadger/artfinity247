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
