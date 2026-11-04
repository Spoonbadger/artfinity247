// oEmbed for artworks: GET /api/embed?url=<artwork URL> (or ?art=<slug>) → JSON with the iframe snippet.
// Lets blogs and site builders that speak oEmbed turn a pasted artwork link into the /embed/art/<slug> card.
import { NextRequest, NextResponse } from "next/server";
import { baseUrl, findShareArt } from "../share/_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugFrom(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get("art")) return q.get("art") as string;
  const url = q.get("url");
  if (!url) return "";
  try {
    const m = new URL(url).pathname.match(/^\/(?:art|embed\/art)\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const slug = slugFrom(req);
  const row = slug ? await findShareArt(slug) : null;
  if (!row || row.status !== "APPROVED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const base = baseUrl(req);
  const q = req.nextUrl.searchParams;
  const width = Math.max(240, Math.min(Number(q.get("maxwidth")) || 320, 480));
  const height = Math.round(width * 1.44);
  const { art } = row;
  const src = new URL(`/embed/art/${encodeURIComponent(art.slug)}`, base).toString();
  const title = `${art.title} by ${art.artist}`.replace(/"/g, "&quot;");
  return NextResponse.json(
    {
      version: "1.0",
      type: "rich",
      provider_name: "Artfinity",
      provider_url: base,
      title: `${art.title} by ${art.artist}`,
      author_name: art.artist,
      author_url: new URL(`/@${art.handle}`, base).toString(),
      width,
      height,
      html: `<iframe src="${src}" width="${width}" height="${height}" style="border:0;max-width:100%" loading="lazy" title="${title}"></iframe>`,
      thumbnail_url: new URL(`/api/share/image?art=${encodeURIComponent(art.slug)}&format=landscape&layout=wall`, base).toString(),
      thumbnail_width: 1200,
      thumbnail_height: 630,
    },
    { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } },
  );
}
