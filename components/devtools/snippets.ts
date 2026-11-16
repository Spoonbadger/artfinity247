// Copy-paste snippets for the embeds. Pure strings, safe on server and client.
import { artUrl } from "@/lib/urls";
import { EMBED_DEFAULTS, embedDataAttrs, embedQuery, estimateHeight, type EmbedOptions } from "@/lib/embed/options";
export const SITE = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
export const SCRIPT_TAG = `<script src="${SITE}/embed.js" async></script>`;

export type Layout = EmbedOptions["layout"];
export type Theme = EmbedOptions["theme"];
export type Options = Partial<EmbedOptions>;

const attrText = (s: string) => s.replace(/[<>"&]/g, "");
const seg = encodeURIComponent;

/** Card embeds only read theme and accent. */
const cardOptions = (o: Options = {}): Options => ({ theme: o.theme, accent: o.accent });

export const gallerySnippet = (handle: string, o: Options = {}) => `<div data-artfinity-artist="${attrText(handle)}"${embedDataAttrs(o)}></div>\n${SCRIPT_TAG}`;
export const collectionSnippet = (handle: string, slug: string, o: Options = {}) =>
  `<div data-artfinity-collection="${attrText(handle)}/${attrText(slug)}"${embedDataAttrs(o)}></div>\n${SCRIPT_TAG}`;
export const cardSnippet = (slug: string, o: Options = {}) => `<div data-artfinity-art="${attrText(slug)}"${embedDataAttrs(cardOptions(o))}></div>\n${SCRIPT_TAG}`;
export const buySnippet = (slug: string) => `<div data-artfinity-buy="${attrText(slug)}"></div>\n${SCRIPT_TAG}`;
export const linksSnippet = (handle: string, theme?: Theme) => `<div data-artfinity-links="${attrText(handle)}"${theme === "dark" ? ` data-theme="dark"` : ""}></div>\n${SCRIPT_TAG}`;

/** No-JavaScript fallback: a plain link that still works where scripts are blocked (email, some site builders). */
export const plainBuyLink = (handle: string, slug: string, title: string) => `<a href="${artUrl(handle, slug, SITE)}">Buy a print of ${title.replace(/[<>"]/g, "")}</a>`;

// ---------------- iframes, for site builders that block scripts ----------------

export const artistPath = (handle: string, o: Options = {}) => `/embed/artist/${seg(handle)}${embedQuery(o)}`;
export const collectionPath = (handle: string, slug: string, o: Options = {}) => `/embed/collection/${seg(handle)}/${seg(slug)}${embedQuery(o)}`;
export const cardPath = (slug: string, o: Options = {}) => `/embed/art/${seg(slug)}${embedQuery(cardOptions(o))}`;

/** The Share kit's iframe card (/embed/art/<slug>): works where scripts are blocked but iframes are fine. */
export const iframeSrc = (slug: string, o: Options = {}) => SITE + cardPath(slug, o);
export const iframeSnippet = (slug: string, title: string, o: Options = {}) =>
  `<iframe src="${iframeSrc(slug, o)}" width="320" height="460" style="border:0;max-width:100%" loading="lazy" title="${attrText(title)}"></iframe>`;

/** A full-width iframe of the artist or collection embed, sized for about 640px wide (it can't grow without the script). */
export function galleryIframeSnippet(path: string, title: string, o: Options = {}, pieces = EMBED_DEFAULTS.count) {
  const h = estimateHeight({ ...EMBED_DEFAULTS, ...o }, 640, pieces);
  return `<iframe src="${SITE}${path}" width="100%" height="${h}" style="border:0;max-width:100%" loading="lazy" title="${attrText(title)}"></iframe>`;
}
