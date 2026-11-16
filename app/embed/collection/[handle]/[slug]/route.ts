// GET /embed/collection/<handle>/<slug> → a self-contained HTML embed of one collection's pieces, for iframes.
// Same options and look as /embed/artist/<handle>; the header names the collection and credits the artist.
// public/embed.js makes these iframes for <div data-artfinity-collection="handle/slug">.
import { NextRequest } from "next/server";
import { siteBase } from "@/components/devtools/publicApi";
import { parseEmbedOptions, resolveAccent } from "@/lib/embed/options";
import { embedHeaders, renderEmbed, renderUnavailable } from "@/lib/embed/render";
import { loadCollectionEmbed, param } from "../../../_data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { handle: string; slug: string } }) {
  const o = parseEmbedOptions(req.nextUrl.searchParams);
  const base = siteBase(req);
  let data;
  try {
    data = await loadCollectionEmbed(param(params.handle), param(params.slug), o.count, base);
  } catch (e) {
    console.error("[embed/collection]", e);
    return new Response(renderUnavailable(base, "This art could not load. Try again in a minute.", o.theme), { status: 500, headers: embedHeaders(false) });
  }
  if (!data) return new Response(renderUnavailable(base, "This collection isn't on Artfinity right now.", o.theme), { status: 404, headers: embedHeaders(false) });
  return new Response(renderEmbed(data.view, o, resolveAccent(o.accent, data.pageAccent)), { headers: embedHeaders(true) });
}
