// The artist and collection embeds (/embed/artist/<handle>, /embed/collection/<handle>/<slug>) as one HTML string:
// inline CSS, two tiny inline scripts (report height to embed.js; un-blur sensitive pieces), no fonts, no framework JS.
// Pure: the routes load the data and hand it over as plain values.
import { esc, extLink, safeUrl } from "./html";
import type { Accent, EmbedOptions, EmbedTheme } from "./options";

export type EmbedEdition = { size: number; remaining: number; soldOut: boolean } | null;

export type EmbedWork = {
  title: string;
  url: string;
  imageUrl: string;
  sensitive: string[];
  /** "$34.99" */
  price: string;
  edition: EmbedEdition;
};

export type EmbedHead = {
  name: string;
  url: string;
  avatar: string | null;
  /** "Brooklyn, NY", or "" */
  location: string;
  verified: boolean;
  medal: string | null;
};

export type EmbedView = {
  artist: EmbedHead;
  /** Set for a collection embed. */
  collection?: { title: string; description: string; url: string } | null;
  works: EmbedWork[];
  /** All public pieces (artist) or the collection's size, for "See all". */
  total: number;
  /** Where "See all" goes: the artist page or the collection page. */
  moreUrl: string;
  /** The Artfinity home page, for the footer mark. */
  homeUrl: string;
};

/** Message the embed pages post to their parent. public/embed.js listens for exactly this shape. */
export const RESIZE_MESSAGE = "artfinity:resize";

/** Reports the document height to the parent page whenever it changes (images loading, the iframe narrowing). */
export const RESIZE_SCRIPT =
  `(function(){var p=window.parent;if(!p||p===window)return;var l=0;function s(){var h=Math.ceil(document.documentElement.getBoundingClientRect().height);` +
  `if(h&&h!==l){l=h;p.postMessage({type:"${RESIZE_MESSAGE}",height:h},"*")}}` +
  `if(window.ResizeObserver)new ResizeObserver(s).observe(document.documentElement);addEventListener("load",s);s()})();`;

/** "Show" on a blurred sensitive piece: one delegated listener. */
export const REVEAL_SCRIPT =
  `document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-show]");if(!b)return;var i=b.closest(".i");` +
  `if(i){i.classList.remove("s");var a=i.querySelector("a");if(a){a.removeAttribute("tabindex");a.removeAttribute("aria-hidden")}}b.parentNode.remove()});`;

/** Headers for every embed page: frameable from any site, nothing else allowed in. */
export function embedHeaders(ok: boolean): Record<string, string> {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": ok ? "public, max-age=300, stale-while-revalidate=86400" : "no-store",
    "Content-Security-Policy":
      "frame-ancestors *; default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  };
}

const LIGHT = "--bg:#fff;--fg:#15161b;--mu:#5a5d6b;--ln:#e1e2da;--im:#e9e6df;--mat:#f2f3ec";
const DARK = "--bg:#15161b;--fg:#f2f3ec;--mu:#a3a6b3;--ln:#30323b;--im:#24262e;--mat:#24262e";

/** CSS custom properties for a theme and accent; `auto` follows the visitor's light or dark setting. */
export function themeCss(theme: EmbedTheme, accent: Accent): string {
  const ac = `--ac:${accent.color};--ai:${accent.ink}`;
  const base = `:root{${theme === "dark" ? DARK : LIGHT};${ac};color-scheme:${theme === "dark" ? "dark" : "light"}}`;
  return theme === "auto" ? `${base}@media (prefers-color-scheme:dark){:root{${DARK};color-scheme:dark}}` : base;
}

/** The whole document around an embed body. */
export function embedDocument({ title, css, body, theme }: { title: string; css: string; body: string; theme: EmbedTheme }): string {
  const scheme = theme === "auto" ? "light dark" : theme;
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><meta name="color-scheme" content="${scheme}"><title>${esc(title)}</title><style>${css}</style></head>` +
    `<body>${body}<script>${RESIZE_SCRIPT}${REVEAL_SCRIPT}</script></body></html>`
  );
}

const CSS =
  `*{box-sizing:border-box;margin:0;padding:0}body{font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:transparent;font-variant-numeric:tabular-nums}` +
  `a{color:inherit;text-decoration:none}a:hover .t,a.t:hover,.f a:hover{text-decoration:underline}` +
  `a:focus-visible,button:focus-visible,[tabindex]:focus-visible{outline:3px solid var(--fg);outline-offset:2px;border-radius:6px}` +
  `.w{background:var(--bg);border:1px solid var(--ln);border-radius:16px;padding:14px;display:grid;gap:12px;min-width:0}` +
  `.h{display:flex;align-items:center;gap:10px;min-width:0}.h img{width:44px;height:44px;border-radius:50%;object-fit:cover;background:var(--im);flex:none}` +
  `.h h1{font-size:16px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}.h p{color:var(--mu);font-size:12.5px}` +
  `.d{color:var(--mu);font-size:13px;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}` +
  `.v{display:inline-grid;place-items:center;width:15px;height:15px;margin-left:4px;border-radius:50%;background:var(--ac);color:var(--ai);font-size:10px;vertical-align:1px}` +
  `.g{display:grid;gap:12px}` +
  `.k{display:grid;grid-auto-flow:column;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px;overscroll-behavior-x:contain}.k>.c{scroll-snap-align:start}` +
  `.c{display:flex;flex-direction:column;gap:5px;min-width:0}.c .b{margin-top:auto}` +
  `.t{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}.m{color:var(--mu);font-size:12.5px}` +
  `.i{position:relative;overflow:hidden;border-radius:10px;background:var(--im);aspect-ratio:4/5}.i a{display:block;height:100%}` +
  `.i img{display:block;width:100%;height:100%;object-fit:cover}` +
  `.s img{filter:blur(18px) saturate(.8);transform:scale(1.15)}` +
  `.o{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:6px;padding:8px;color:#fff;font-size:12px;text-align:center;background:rgba(21,22,27,.3)}` +
  `.o button{font:inherit;font-weight:700;cursor:pointer;border:0;border-radius:999px;background:#fff;color:#15161b;padding:5px 14px}` +
  `.b{display:inline-flex;align-items:center;justify-content:center;font-weight:700;border-radius:999px;background:var(--ac);color:var(--ai);padding:7px 12px;font-size:13px;margin-top:3px}.b:hover{filter:brightness(1.1)}` +
  `.x .i{aspect-ratio:auto;background:var(--mat);display:grid;place-items:center;padding:14px}.x .i a{height:auto}.x .i img{width:auto;max-width:100%;height:auto;max-height:520px;object-fit:contain}` +
  `.x .t{font-size:18px;white-space:normal}.x .b{padding:10px 18px;font-size:14px;justify-self:start}` +
  `.f{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;color:var(--mu);font-size:12.5px}.f a{display:inline-flex;align-items:center;gap:6px}` +
  `.e{color:var(--mu);padding:8px 0}` +
  `.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}`;

const MARK =
  `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="none" stroke="currentColor" stroke-width="3"/><rect x="7" y="7" width="10" height="10" rx="1.5" fill="var(--ac)"/></svg>`;

/** "3 of 10 left", "Edition sold out"; `long` adds "Limited edition of 10 · ". */
export function editionText(e: EmbedEdition, long = false): string {
  if (!e) return "";
  if (e.soldOut) return "Edition sold out";
  return (long ? `Limited edition of ${e.size} · ` : "") + `${e.remaining} of ${e.size} left`;
}

/** grid-template-columns: `n` columns that drop to fewer when each would be narrower than `min`; 0 = auto-fill. */
export function gridColumns(n: number, min = 140): string {
  if (!n) return `repeat(auto-fill,minmax(${min}px,1fr))`;
  if (n === 1) return "minmax(0,1fr)";
  return `repeat(auto-fill,minmax(max(${min}px,calc((100% - ${(n - 1) * 12}px) / ${n})),1fr))`;
}

/** Carousel card width: `n` per view (0 = about 2.5 on a phone, 220px each when wide). */
export function carouselColumns(n: number): string {
  if (!n) return "min(72%,220px)";
  if (n === 1) return "100%";
  return `max(130px,calc((100% - ${(n - 1) * 12}px) / ${n}))`;
}

function image(w: EmbedWork) {
  const sensitive = w.sensitive.length > 0;
  const img = `<img src="${safeUrl(w.imageUrl)}" alt="${esc(w.title)}" loading="lazy" decoding="async">`;
  // The picture repeats the title link, so it stays out of the tab order and the reading order (until revealed, for sensitive pieces).
  return (
    `<div class="i${sensitive ? " s" : ""}">${extLink(w.url, img, `tabindex="-1" aria-hidden="true"`)}` +
    (sensitive
      ? `<div class="o"><span>${esc(w.sensitive.join(", "))}</span><button type="button" data-show aria-label="Show ${esc(w.title)}">Show</button></div>`
      : "") +
    `</div>`
  );
}

function meta(w: EmbedWork, o: EmbedOptions, long = false) {
  const bits = [o.prices ? `From ${w.price}` : "", editionText(w.edition, long)].filter(Boolean);
  return bits.length ? `<p class="m">${esc(bits.join(" · "))}</p>` : "";
}

const buy = (w: EmbedWork) => extLink(w.url, "Buy a print", `class="b" aria-label="Buy a print of ${esc(w.title)}"`);

function card(w: EmbedWork, o: EmbedOptions) {
  return `<li class="c">${image(w)}${extLink(w.url, esc(w.title), `class="t"`)}${meta(w, o)}${buy(w)}</li>`;
}

function big(w: EmbedWork, o: EmbedOptions, artist: string) {
  return (
    `<div class="c x">${image(w)}<div>${extLink(w.url, esc(w.title), `class="t"`)}` +
    `<p class="m">${esc(artist)}</p>${meta(w, o, true)}</div>${buy(w)}</div>`
  );
}

function header(v: EmbedView) {
  const a = v.artist;
  const avatar = a.avatar ? `<img src="${safeUrl(a.avatar)}" alt="" width="44" height="44">` : "";
  const check = a.verified ? `<span class="v" title="Verified by Artfinity" aria-hidden="true">✓</span><span class="sr"> (verified)</span>` : "";
  if (v.collection) {
    const c = v.collection;
    const by = [`by ${a.name}`, a.location].filter(Boolean).join(" · ");
    return (
      `<header class="h">${extLink(a.url, avatar, `tabindex="-1" aria-hidden="true"`)}<div style="min-width:0">` +
      `<h1>${extLink(c.url, esc(c.title))}</h1><p>${extLink(a.url, esc(by))}${check}</p>` +
      (c.description ? `<p class="d">${esc(c.description)}</p>` : "") +
      `</div></header>`
    );
  }
  const sub = [a.location, a.medal].filter(Boolean).join(" · ");
  return (
    `<header class="h">${extLink(a.url, avatar, `tabindex="-1" aria-hidden="true"`)}<div style="min-width:0">` +
    `<h1>${extLink(a.url, esc(a.name))}${check}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</div></header>`
  );
}

/** The full HTML document for an artist or collection embed. */
export function renderEmbed(v: EmbedView, o: EmbedOptions, accent: Accent): string {
  const works = v.works.slice(0, o.layout === "single" ? 1 : o.count);
  const what = v.collection ? `${v.collection.title} by ${v.artist.name}` : `Art by ${v.artist.name}`;
  let body: string;
  if (!works.length) {
    body = `<p class="e">No pieces to show yet.</p>`;
  } else if (o.layout === "single") {
    body = big(works[0], o, v.artist.name);
  } else if (o.layout === "carousel") {
    body =
      `<ul class="k" role="list" tabindex="0" aria-label="${esc(what)}, scroll for more" style="grid-auto-columns:${carouselColumns(o.columns)};list-style:none">` +
      works.map((w) => card(w, o)).join("") +
      `</ul>`;
  } else {
    body = `<ul class="g" role="list" aria-label="${esc(what)}" style="grid-template-columns:${gridColumns(o.columns)};list-style:none">${works.map((w) => card(w, o)).join("")}</ul>`;
  }
  const seeAll = v.total > works.length ? `See all ${v.total}` : v.collection ? "See the collection" : "See the page";
  const foot =
    `<footer class="f">${extLink(v.moreUrl, `${esc(seeAll)} <span aria-hidden="true">→</span>`)}` +
    `${extLink(v.homeUrl, `${MARK}Prints by Artfinity`)}</footer>`;
  const main = `<main class="w">${o.header ? header(v) : ""}${body}${foot}</main>`;
  return embedDocument({ title: what, css: themeCss(o.theme, accent) + CSS, body: main, theme: o.theme });
}

/** A small "not available" page, still framed and themed, so a removed artist doesn't leave a broken box. */
export function renderUnavailable(homeUrl: string, message: string, theme: EmbedTheme = "light"): string {
  const accent = { color: "#8b2a4b", ink: "#ffffff" };
  const body = `<main class="w"><p class="e">${esc(message)}</p><footer class="f"><span></span>${extLink(homeUrl, `${MARK}Artfinity`)}</footer></main>`;
  return embedDocument({ title: message, css: themeCss(theme, accent) + CSS, body, theme });
}
