// GET /embed/artist/<handle> → a self-contained HTML embed for iframes: the artist's header and a grid of their work.
// Options in the query string (lib/embed/options.ts): layout, columns, count, theme, accent, prices, header.
// No app shell, no web fonts, no framework JS. Frameable from any site; links open Artfinity in a new tab.
// public/embed.js makes these iframes for <div data-artfinity-artist="handle"> and resizes them to fit.
import { NextRequest } from "next/server";
import { siteBase } from "@/components/devtools/publicApi";
import { parseEmbedOptions, resolveAccent } from "@/lib/embed/options";
import { embedHeaders, renderEmbed, renderUnavailable } from "@/lib/embed/render";
import { loadArtistEmbed, param } from "../../_data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { handle: string } }) {
  const o = parseEmbedOptions(req.nextUrl.searchParams);
  const base = siteBase(req);
  let data;
  try {
    data = await loadArtistEmbed(param(params.handle), o.count, base);
  } catch (e) {
    console.error("[embed/artist]", e);
    return new Response(renderUnavailable(base, "This art could not load. Try again in a minute.", o.theme), { status: 500, headers: embedHeaders(false) });
  }
  if (!data) return new Response(renderUnavailable(base, "This artist isn't on Artfinity right now.", o.theme), { status: 404, headers: embedHeaders(false) });
  return new Response(renderEmbed(data.view, o, resolveAccent(o.accent, data.pageAccent)), { headers: embedHeaders(true) });
}
