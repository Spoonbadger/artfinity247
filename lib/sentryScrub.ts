// PII scrubbing for Sentry events (sentry.*.config.ts and instrumentation-client.ts). Pure, any runtime.
// No emails, street addresses, cookies, auth headers or request bodies leave the app: keys that look personal
// are replaced, and any email-looking text in messages, breadcrumbs and extra data is masked.
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SECRET_KEY = /email|e-mail|address|street|zip|postal|phone|cookie|authorization|password|passwd|secret|token|session|shipping|billing|card|iban|venmo/i;
const FILTERED = "[Filtered]";

function scrubValue(v: unknown, depth = 0): unknown {
  if (typeof v === "string") return v.replace(EMAIL, "[email]");
  if (!v || typeof v !== "object" || depth > 6) return v;
  if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = SECRET_KEY.test(k) ? FILTERED : scrubValue(x, depth + 1);
  return out;
}

type AnyEvent = {
  message?: string;
  user?: Record<string, unknown>;
  request?: { cookies?: unknown; headers?: Record<string, string>; data?: unknown; query_string?: unknown; url?: string };
  extra?: Record<string, unknown>;
  contexts?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: { message?: string; data?: Record<string, unknown> }[];
  exception?: { values?: { value?: string }[] };
};

/** beforeSend / beforeSendTransaction: strip personal data. Returns the same event, scrubbed. */
export function scrubEvent<T>(event: T): T {
  const e = event as unknown as AnyEvent;
  // Only an opaque id may stay on the user (no email, IP or name).
  if (e.user) e.user = typeof e.user.id === "string" ? { id: e.user.id } : {};
  if (e.request) {
    delete e.request.cookies;
    delete e.request.data;
    if (e.request.headers) {
      const h: Record<string, string> = {};
      for (const [k, v] of Object.entries(e.request.headers)) h[k] = SECRET_KEY.test(k) || /^x-forwarded-for$|^x-real-ip$/i.test(k) ? FILTERED : v;
      e.request.headers = h;
    }
    if (typeof e.request.query_string === "string") e.request.query_string = (e.request.query_string as string).replace(EMAIL, "[email]");
    if (e.request.url) e.request.url = e.request.url.replace(EMAIL, "[email]");
  }
  if (e.message) e.message = e.message.replace(EMAIL, "[email]");
  for (const x of e.exception?.values ?? []) if (x.value) x.value = x.value.replace(EMAIL, "[email]");
  if (e.extra) e.extra = scrubValue(e.extra) as Record<string, unknown>;
  if (e.contexts) e.contexts = scrubValue(e.contexts) as Record<string, unknown>;
  if (e.tags) e.tags = scrubValue(e.tags) as Record<string, unknown>;
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map((b) => scrubBreadcrumb(b));
  return event;
}

export function scrubBreadcrumb<T>(b: T): T {
  const x = b as unknown as { message?: string; data?: Record<string, unknown> };
  if (x.message) x.message = x.message.replace(EMAIL, "[email]");
  if (x.data) x.data = scrubValue(x.data) as Record<string, unknown>;
  return b;
}

/**
 * What the SDK may collect (Sentry v11 `dataCollection`): no user info, cookies, bodies, query strings, DB values or
 * local variables; only harmless request headers. scrubEvent still runs on whatever is left.
 */
export const dataCollection = () => ({
  userInfo: false,
  cookies: false,
  httpHeaders: { request: { allow: ["user-agent", "content-type", "accept", "referer"] }, response: false },
  httpBodies: [] as never[],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
});

/** Low by default: 5% of requests traced. SENTRY_TRACES_SAMPLE_RATE overrides (0 turns tracing off). */
export function tracesRate(raw: string | undefined, fallback = 0.05) {
  const n = Number(raw);
  return raw != null && raw !== "" && Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}
