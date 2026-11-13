// Copy-paste snippets for the embed script. Pure strings, safe on server and client.
import { artUrl } from "@/lib/urls";
export const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
export const SCRIPT_TAG = `<script src="${SITE}/embed.js" async></script>`;

export type Layout = "grid" | "carousel" | "single";
export type Theme = "light" | "dark";

const themeAttr = (t?: Theme) => (t === "dark" ? ` data-theme="dark"` : "");

export function gallerySnippet(handle: string, o: { layout?: Layout; limit?: number; theme?: Theme } = {}) {
  const layout = o.layout || "grid";
  const limit = layout === "single" ? "" : ` data-limit="${o.limit ?? 6}"`;
  return `<div data-artfinity-artist="${handle}" data-layout="${layout}"${limit}${themeAttr(o.theme)}></div>\n${SCRIPT_TAG}`;
}

export const cardSnippet = (slug: string, theme?: Theme) => `<div data-artfinity-art="${slug}"${themeAttr(theme)}></div>\n${SCRIPT_TAG}`;
export const buySnippet = (slug: string) => `<div data-artfinity-buy="${slug}"></div>\n${SCRIPT_TAG}`;
export const linksSnippet = (handle: string, theme?: Theme) => `<div data-artfinity-links="${handle}"${themeAttr(theme)}></div>\n${SCRIPT_TAG}`;

/** No-JavaScript fallback: a plain link that still works where scripts are blocked (email, some site builders). */
export const plainBuyLink = (handle: string, slug: string, title: string) => `<a href="${artUrl(handle, slug, SITE)}">Buy a print of ${title.replace(/[<>"]/g, "")}</a>`;

/** The Share kit's iframe card (/embed/art/<slug>): works where scripts are blocked but iframes are fine. */
export const iframeSrc = (slug: string) => `${SITE}/embed/art/${encodeURIComponent(slug)}`;
export const iframeSnippet = (slug: string, title: string) =>
  `<iframe src="${iframeSrc(slug)}" width="320" height="460" style="border:0;max-width:100%" loading="lazy" title="${title.replace(/[<>"&]/g, "")}"></iframe>`;
