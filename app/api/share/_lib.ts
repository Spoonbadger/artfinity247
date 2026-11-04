// Server helpers for the Share kit routes and the embed widget.
import path from "node:path";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { fromCents, paletteFromPixels, type ShareArt } from "@/components/share/shareData";

const select = {
  slug: true, title: true, description: true, imageUrl: true, status: true, sensitive: true, artistId: true,
  markupSmall: true, editionSize: true,
  artist: { select: { name: true, artist_name: true, slug: true, city: true } },
} as const;

export async function findShareArt(slug: string) {
  const r = await prisma.artwork.findUnique({ where: { slug }, select });
  if (!r?.slug) return null;
  const art: ShareArt = {
    slug: r.slug,
    title: r.title,
    artist: r.artist.artist_name || r.artist.name || "",
    handle: r.artist.slug,
    city: r.artist.city || null,
    description: r.description || "",
    imageUrl: r.imageUrl,
    fromCents: fromCents(r.markupSmall),
    editionSize: r.editionSize ?? null,
    sensitive: r.sensitive ?? [],
  };
  return { art, status: r.status, artistId: r.artistId };
}

/** Approved art is public; anything else only for its artist or an admin. */
export function canSee(row: { status: string; artistId: string }, user: { id?: string; role?: string } | null) {
  return row.status === "APPROVED" || (!!user?.id && (user.id === row.artistId || user.role === "ADMIN"));
}

/** Public base URL: the configured app URL, else this request's origin. */
export function baseUrl(req: Request) {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "theartfinity.com";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// ---------------- painting pixels ----------------
type Source = { buf: Buffer; w: number; h: number; palette: string[] };
const sources = new Map<string, Promise<Source>>();

async function readSource(url: string): Promise<Buffer> {
  if (url.startsWith("/")) {
    const pub = path.join(process.cwd(), "public");
    const file = path.normalize(path.join(pub, decodeURIComponent(url.split("?")[0])));
    if (!file.startsWith(pub + path.sep)) throw new Error("Bad image path");
    return readFile(file);
  }
  if (!/^https:\/\//.test(url)) throw new Error("Unsupported image URL");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The painting, upright, at most 1600 px, with its size and a small palette. Cached in memory. */
export function paintingSource(url: string): Promise<Source> {
  let hit = sources.get(url);
  if (!hit) {
    hit = (async () => {
      const raw = await readSource(url);
      const buf = await sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
      const meta = await sharp(buf).metadata();
      const px = await sharp(buf).resize(8, 8, { fit: "fill" }).ensureAlpha().raw().toBuffer();
      return { buf, w: meta.width || 1, h: meta.height || 1, palette: paletteFromPixels(px, 5) };
    })();
    hit.catch(() => sources.delete(url));
    if (sources.size > 80) sources.delete(sources.keys().next().value as string);
    sources.set(url, hit);
  }
  return hit;
}

let noiseTile: Promise<string> | null = null;
/** A 200 px paper grain tile (transparent, dark and light specks). */
export function grain(): Promise<string> {
  if (!noiseTile) {
    noiseTile = (async () => {
      const n = 200, data = Buffer.alloc(n * n * 4);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < n * n; i++) {
        const v = rnd(), light = v > 0.5;
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = light ? 255 : 40;
        data[i * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * 26);
      }
      const png = await sharp(data, { raw: { width: n, height: n, channels: 4 } }).png().toBuffer();
      return "data:image/png;base64," + png.toString("base64");
    })();
  }
  return noiseTile;
}
