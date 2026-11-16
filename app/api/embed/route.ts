// oEmbed: GET /api/embed?url=<Artfinity link> → JSON with an iframe snippet. Lets blogs and site builders that speak
// oEmbed turn a pasted link into an embed:
//   artwork links (/@handle/art/<slug>, /art/<slug>)  → the /embed/art/<slug> card (also ?art=<slug>)
//   artist pages (/@handle, /@handle/links)          → /embed/artist/<handle> (also ?artist=<handle>)
//   collections (/@handle/collections/<c>)           → /embed/collection/<handle>/<c>
// Only JSON (format=xml gets 501, as the spec asks). maxwidth/maxheight are honored.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { artistUrl } from "@/lib/urls";
import { parseEmbedUrl, type EmbedTarget } from "@/lib/embed/target";
import { EMBED_DEFAULTS, estimateHeight } from "@/lib/embed/options";
import { displayName } from "@/components/devtools/publicApi";
import { findEmbedArtist } from "@/app/embed/_data";
import { baseUrl, findShareArt } from "../share/_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" };
const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });

function targetFrom(req: NextRequest): EmbedTarget | null {
  const q = req.nextUrl.searchParams;
  const art = q.get("art");
  if (art) return { kind: "art", slug: art };
  const artist = q.get("artist");
  if (artist) return { kind: "artist", handle: artist.replace(/^@/, "") };
  const url = q.get("url");
  return url ? parseEmbedUrl(url) : null;
}

const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function iframe(src: string, width: number, height: number, title: string, fluid: boolean) {
  const style = fluid ? `border:0;width:100%;max-width:${width}px` : "border:0;max-width:100%";
  return `<iframe src="${attr(src)}" width="${width}" height="${height}" style="${style}" loading="lazy" title="${attr(title)}"></iframe>`;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const format = (q.get("format") || "json").toLowerCase();
  if (format !== "json") return NextResponse.json({ error: "Only format=json is supported." }, { status: 501, headers: { "Access-Control-Allow-Origin": "*" } });
  const target = targetFrom(req);
  if (!target) return notFound();
  const base = baseUrl(req);
  const maxW = Number(q.get("maxwidth")) || 0;
  const maxH = Number(q.get("maxheight")) || 0;
  const common = { version: "1.0", type: "rich", provider_name: "Artfinity", provider_url: base };

  if (target.kind === "art") {
    const row = await findShareArt(target.slug);
    if (!row || row.status !== "APPROVED") return notFound();
    const width = Math.max(240, Math.min(maxW || 320, 480));
    let height = Math.round(width * 1.44);
    if (maxH) height = Math.max(200, Math.min(height, maxH));
    const { art } = row;
    const src = new URL(`/embed/art/${encodeURIComponent(art.slug)}`, base).toString();
    const title = `${art.title} by ${art.artist}`;
    return NextResponse.json(
      {
        ...common,
        title,
        author_name: art.artist,
        author_url: new URL(`/@${art.handle}`, base).toString(),
        width,
        height,
        html: iframe(src, width, height, title, false),
        thumbnail_url: new URL(`/api/share/image?art=${encodeURIComponent(art.slug)}&format=landscape&layout=wall`, base).toString(),
        thumbnail_width: 1200,
        thumbnail_height: 630,
      },
      { headers: HEADERS },
    );
  }

  const artist = await findEmbedArtist(target.handle);
  if (!artist) return notFound();
  const name = displayName(artist);
  const width = Math.max(280, Math.min(maxW || 600, 1200));
  let src: string, title: string, count: number;
  if (target.kind === "collection") {
    const col = await prisma.collection.findFirst({
      where: { artistId: artist.id, slug: { equals: target.slug, mode: "insensitive" } },
      select: { slug: true, title: true, _count: { select: { items: { where: { artwork: { status: "APPROVED", slug: { not: null } } } } } } },
    });
    if (!col || !col._count.items) return notFound();
    src = new URL(`/embed/collection/${encodeURIComponent(artist.slug)}/${encodeURIComponent(col.slug)}`, base).toString();
    title = `${col.title} by ${name}`;
    count = col._count.items;
  } else {
    count = await prisma.artwork.count({ where: { artistId: artist.id, status: "APPROVED", slug: { not: null } } });
    src = new URL(`/embed/artist/${encodeURIComponent(artist.slug)}`, base).toString();
    title = `Art by ${name}`;
  }
  let height = estimateHeight(EMBED_DEFAULTS, width, count);
  if (maxH) height = Math.max(200, Math.min(height, maxH));
  return NextResponse.json(
    { ...common, title, author_name: name, author_url: artistUrl(artist.slug, base), width, height, html: iframe(src, width, height, title, true) },
    { headers: HEADERS },
  );
}
