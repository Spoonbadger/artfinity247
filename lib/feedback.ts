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
  email_unverified: { label: "Confirm email", href: "/studio/page#account" },
  not_logged_in: { label: "Log in", href: "/login" },
  unauthorized: { label: "Log in", href: "/login" },
  stripe_not_connected: { label: "Connect Stripe", href: "/studio/money" },
  venmo_missing: { label: "Add Venmo", href: "/studio/money" },
  infinity_required: { label: "See Infinity", href: "/studio/infinity" },
  daily_limit: { label: "See followers", href: "/studio/followers" },
};

export async function problemFrom(res: Response, fallback = "Something went wrong"): Promise<{ message: string; fix?: Fix }> {
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
  return { message, fix: code ? FIXES[code] : undefined };
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
