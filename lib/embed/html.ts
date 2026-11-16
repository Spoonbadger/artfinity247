// HTML helpers for the self-contained embed pages (/embed/*). Pure: no DOM, no Node APIs.

const ENT: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes text for HTML element content and double- or single-quoted attributes. */
export function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ENT[c]);
}

/** An absolute http(s) URL, escaped for an attribute; anything else (javascript:, data:, relative junk) becomes "#". */
export function safeUrl(u: string | null | undefined): string {
  const s = (u ?? "").trim();
  if (!/^https?:\/\//i.test(s)) return "#";
  try {
    return esc(new URL(s).toString());
  } catch {
    return "#";
  }
}

/** A link that opens the real Artfinity page in a new tab (embeds never navigate the host page). */
export function extLink(href: string, inner: string, attrs = ""): string {
  return `<a href="${safeUrl(href)}" target="_blank" rel="noopener"${attrs ? " " + attrs : ""}>${inner}</a>`;
}
