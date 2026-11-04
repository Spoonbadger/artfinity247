// GET /embed/art/<slug> → a tiny, self-contained HTML card for iframes:
// the painting, title, artist, price and a "Buy a print" button. No app shell, no web fonts, no framework JS.
// Keep this URL stable: the share kit snippet and the developer docs point at it.
import { NextRequest } from "next/server";
import { artLink, dollars } from "@/components/share/shareData";
import { baseUrl, findShareArt, paintingSource } from "@/app/api/share/_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const CSS = `*{box-sizing:border-box;margin:0}html,body{height:100%}body{font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#15161b;background:transparent;display:flex}
.c{flex:1;display:flex;flex-direction:column;gap:12px;min-width:0;padding:14px;background:#fff;border:1.5px solid #15161b;border-radius:16px;overflow:hidden}
.f{position:relative;flex:1;min-height:140px;background:#f2f3ec;border-radius:10px;overflow:hidden}
.f img{position:absolute;inset:14px;width:calc(100% - 28px);height:calc(100% - 28px);object-fit:contain;filter:drop-shadow(0 3px 7px rgba(21,22,27,.3))}
.b img{filter:blur(18px) saturate(.8)}.b button{position:absolute;inset:auto auto 12px 50%;transform:translateX(-50%);font:600 13px system-ui,sans-serif;padding:6px 12px;border-radius:99px;border:1.5px solid #15161b;background:#fff;cursor:pointer}
h1{font-size:19px;font-weight:800;letter-spacing:-.01em;line-height:1.15;overflow-wrap:anywhere}
.m{display:flex;justify-content:space-between;align-items:baseline;gap:8px;color:#5a5d6b;font-size:13.5px}
.p{position:relative;z-index:0;color:#15161b;font-weight:600;white-space:nowrap}.p:before{content:"";position:absolute;inset:-2px -6px;background:#ffd43b;border-radius:40% 55% 45% 60%/60% 40% 60% 40%;z-index:-1;transform:rotate(-2deg)}
.e{color:#15161b;font-size:12.5px}.e:before{content:"";display:inline-block;width:9px;height:9px;margin-right:6px;background:#ff5a36;border-radius:52% 44% 58% 40%;transform:rotate(-14deg)}
a.buy{display:block;text-align:center;text-decoration:none;font-weight:700;color:#fff;background:#2b37f0;border:2px solid #2b37f0;border-radius:99px;padding:11px 16px}
a.buy:hover{filter:brightness(1.12)}a:focus-visible,button:focus-visible{outline:3px solid #2b37f0;outline-offset:2px}
.by{display:flex;align-items:center;gap:6px;justify-content:center;color:#5a5d6b;font-size:11.5px;text-decoration:none}.by i{width:11px;height:11px;border:1.5px solid #15161b;border-radius:2px;display:grid;place-items:center}.by i:after{content:"";width:4px;height:4px;background:#2b37f0;border-radius:1px}`;

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": status === 200 ? "public, max-age=300, stale-while-revalidate=86400" : "no-store",
        "Content-Security-Policy": "frame-ancestors *; default-src 'none'; img-src 'self' https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'",
      },
    },
  );
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const row = await findShareArt(decodeURIComponent(params.slug)).catch(() => null);
  const base = baseUrl(req);
  if (!row || row.status !== "APPROVED") {
    return page("Not available", `<div class="c"><h1>This piece isn't available</h1><a class="by" href="${esc(base)}" target="_blank" rel="noopener"><i></i>artfinity</a></div>`, 404);
  }
  const { art } = row;
  const src = await paintingSource(art.imageUrl).catch(() => null);
  const dims = src ? ` width="${src.w}" height="${src.h}"` : "";
  const img = `/api/share/painting?art=${encodeURIComponent(art.slug)}&w=640`;
  const buy = artLink(base, art.slug, "embed");
  const sensitive = art.sensitive.length > 0;
  const alt = `${art.title} by ${art.artist}`;
  const body =
    `<main class="c">` +
    `<div class="f${sensitive ? " b" : ""}" id="f"><img src="${img}" alt="${esc(alt)}"${dims}>` +
    (sensitive ? `<button type="button" onclick="document.getElementById('f').classList.remove('b');this.remove()">Show: ${esc(art.sensitive.join(", ").toLowerCase())}</button>` : "") +
    `</div>` +
    `<div><h1>${esc(art.title)}</h1><div class="m"><span>by ${esc(art.artist)}</span><span class="p">From ${dollars(art.fromCents)}</span></div>` +
    (art.editionSize ? `<div class="e">Limited edition of ${art.editionSize}</div>` : "") +
    `</div>` +
    `<a class="buy" href="${esc(buy)}" target="_blank" rel="noopener">Buy a print</a>` +
    `<a class="by" href="${esc(new URL(`/@${art.handle}`, base).toString())}" target="_blank" rel="noopener"><i></i>artfinity</a>` +
    `</main>`;
  return page(alt, body);
}
