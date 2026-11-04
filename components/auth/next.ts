// The `?next=` hand-off used by the Studio and admin gates.

/** A same-site path we can safely send someone to after logging in, or null. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\r\n\t]/.test(v)) return null;
  return v;
}

/** Appends `next` (when safe) to an auth link, keeping any other query. */
export function withNext(href: string, next: string | null | undefined, extra: Record<string, string> = {}): string {
  const [path, query = ""] = href.split("?");
  const q = new URLSearchParams(query);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const n = safeNext(next);
  if (n) q.set("next", n);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
