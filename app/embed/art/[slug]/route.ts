// GET /embed/art/<slug> → a tiny, self-contained HTML card for iframes:
// the painting, title, artist, price and a "Buy a print" button. No app shell, no web fonts, no framework JS.
// Keep this URL stable: the share kit snippet and the developer docs point at it.
// Optional query: theme=light|dark|auto, accent=<paint id or hex> (default: the artist's page accent),
// autosize=1 (sized by its content instead of filling a fixed iframe; public/embed.js adds it and resizes the frame).
import { NextRequest } from "next/server";
import { artLink, dollars } from "@/components/share/shareData";
import { baseUrl, findShareArt, paintingSource } from "@/app/api/share/_lib";
import { parseTheme } from "@/components/artist/theme";
import { prisma } from "@/lib/prisma";
import { esc } from "@/lib/embed/html";
import { parseBool, parseEmbedOptions, resolveAccent, type Accent, type EmbedTheme } from "@/lib/embed/options";
import { embedDocument, embedHeaders } from "@/lib/embed/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIGHT = "--bg:#fff;--fg:#15161b;--mu:#5a5d6b;--mat:#f2f3ec";
const DARK = "--bg:#15161b;--fg:#f2f3ec;--mu:#a3a6b3;--mat:#24262e";

function vars(theme: EmbedTheme, a: Accent) {
  const root = `:root{${theme === "dark" ? DARK : LIGHT};--ac:${a.color};--ai:${a.ink}}`;
  return theme === "auto" ? `${root}@media (prefers-color-scheme:dark){:root{${DARK}}}` : root;
}

const CSS = `*{box-sizing:border-box;margin:0}html,body{height:100%}body{font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:transparent;display:flex}
.c{flex:1;display:flex;flex-direction:column;gap:12px;min-width:0;padding:14px;background:var(--bg);border:1.5px solid var(--fg);border-radius:16px;overflow:hidden}
.f{position:relative;flex:1;min-height:140px;background:var(--mat);border-radius:10px;overflow:hidden}
.f img{position:absolute;inset:14px;width:calc(100% - 28px);height:calc(100% - 28px);object-fit:contain;filter:drop-shadow(0 3px 7px rgba(21,22,27,.3))}
.b img{filter:blur(18px) saturate(.8)}.b button{position:absolute;inset:auto auto 12px 50%;transform:translateX(-50%);font:600 13px system-ui,sans-serif;padding:6px 12px;border-radius:99px;border:1.5px solid #15161b;background:#fff;color:#15161b;cursor:pointer}
h1{font-size:19px;font-weight:800;letter-spacing:-.01em;line-height:1.15;overflow-wrap:anywhere}
.m{display:flex;justify-content:space-between;align-items:baseline;gap:8px;color:var(--mu);font-size:13.5px}
.p{position:relative;z-index:0;color:#15161b;font-weight:600;white-space:nowrap}.p:before{content:"";position:absolute;inset:-2px -6px;background:#ffd43b;border-radius:40% 55% 45% 60%/60% 40% 60% 40%;z-index:-1;transform:rotate(-2deg)}
.e{color:var(--fg);font-size:12.5px}.e:before{content:"";display:inline-block;width:9px;height:9px;margin-right:6px;background:#ff5a36;border-radius:52% 44% 58% 40%;transform:rotate(-14deg)}
a.buy{display:block;text-align:center;text-decoration:none;font-weight:700;color:var(--ai);background:var(--ac);border:2px solid var(--ac);border-radius:99px;padding:11px 16px}
a.buy:hover{filter:brightness(1.12)}a:focus-visible,button:focus-visible{outline:3px solid var(--fg);outline-offset:2px}
.by{display:flex;align-items:center;gap:6px;justify-content:center;color:var(--mu);font-size:11.5px;text-decoration:none}.by i{width:11px;height:11px;border:1.5px solid var(--fg);border-radius:2px;display:grid;place-items:center}.by i:after{content:"";width:4px;height:4px;background:var(--ac);border-radius:1px}`;

/** autosize=1: the card is as tall as its content (the painting keeps its shape) instead of filling the frame. */
const AUTO = `html,body{height:auto}.c{flex:none;width:100%}.f{flex:none;max-height:520px}`;

const GARNET: Accent = { color: "#8b2a4b", ink: "#ffffff" };

function page(title: string, body: string, status: number, theme: EmbedTheme, accent: Accent, extraCss = "") {
  return new Response(embedDocument({ title, css: vars(theme, accent) + CSS + extraCss, body, theme }), { status, headers: embedHeaders(status === 200) });
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const q = req.nextUrl.searchParams;
  const { theme, accent: accentOpt } = parseEmbedOptions(q);
  const autosize = parseBool(q.get("autosize"), false);
  let slug = "";
  try {
    slug = decodeURIComponent(params.slug);
  } catch {}
  const row = slug ? await findShareArt(slug).catch(() => null) : null;
  const base = baseUrl(req);
  if (!row || row.status !== "APPROVED") {
    const body = `<div class="c"><h1>This piece isn't available</h1><a class="by" href="${esc(base)}" target="_blank" rel="noopener"><i></i>artfinity</a></div>`;
    return page("Not available", body, 404, theme, resolveAccent(accentOpt, null), autosize ? AUTO : "");
  }
  const { art } = row;
  const [src, owner] = await Promise.all([
    paintingSource(art.imageUrl).catch(() => null),
    prisma.artist.findUnique({ where: { slug: art.handle }, select: { pageTheme: true } }).catch(() => null),
  ]);
  const accent = owner ? resolveAccent(accentOpt, parseTheme(owner.pageTheme).accent) : accentOpt ? resolveAccent(accentOpt) : GARNET;
  const dims = src ? ` width="${src.w}" height="${src.h}"` : "";
  // In autosize mode the frame takes the painting's proportions (plus its 14px mat) so the height follows the width.
  const shape = autosize && src ? ` style="aspect-ratio:${src.w + 28} / ${src.h + 28}"` : autosize ? ` style="aspect-ratio:4 / 5"` : "";
  const img = `/api/share/painting?art=${encodeURIComponent(art.slug)}&w=640`;
  const buy = artLink(base, art.handle, art.slug, "embed");
  const sensitive = art.sensitive.length > 0;
  const alt = `${art.title} by ${art.artist}`;
  const body =
    `<main class="c">` +
    `<div class="f${sensitive ? " b" : ""}" id="f"${shape}><img src="${img}" alt="${esc(alt)}"${dims}>` +
    (sensitive ? `<button type="button" onclick="document.getElementById('f').classList.remove('b');this.remove()">Show: ${esc(art.sensitive.join(", ").toLowerCase())}</button>` : "") +
    `</div>` +
    `<div><h1>${esc(art.title)}</h1><div class="m"><span>by ${esc(art.artist)}</span><span class="p">From ${dollars(art.fromCents)}</span></div>` +
    (art.editionSize ? `<div class="e">Limited edition of ${art.editionSize}</div>` : "") +
    `</div>` +
    `<a class="buy" href="${esc(buy)}" target="_blank" rel="noopener">Buy a print</a>` +
    `<a class="by" href="${esc(new URL(`/@${art.handle}`, base).toString())}" target="_blank" rel="noopener"><i></i>artfinity</a>` +
    `</main>`;
  return page(alt, body, 200, theme, accent, autosize ? AUTO : "");
}
