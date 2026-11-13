// Server only. Colours and a thumbnail from an artwork's public preview, for the QR Studio's Infinity extras
// (Match your art, With thumbnail). Uses sharp; works on local /uploads and /seed files and Cloudinary previews.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { matchAccent, type ArtInfo } from "@/components/qr/card";

/** The public preview's bytes (never the private original). Other hosts: null. */
export async function readPreview(url: string): Promise<Buffer | null> {
  const clean = url.split("?")[0];
  if (/^\/(?:[\w.-]+\/)*[\w.-]+\.(?:jpe?g|png|webp|gif|avif|tiff?)$/i.test(clean) && !clean.includes("..")) {
    const pub = path.join(process.cwd(), "public");
    const file = path.join(pub, ...clean.split("/").filter(Boolean));
    return file.startsWith(pub + path.sep) ? fs.readFile(file).catch(() => null) : null;
  }
  if (/^https:\/\/res\.cloudinary\.com\//.test(clean)) {
    const res = await fetch(url).catch(() => null);
    return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
  }
  return null;
}

const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * Up to 3 dominant colours, most common first. Pixels are bucketed (4 bits per channel); near-white and near-black
 * buckets count less (canvas and shadows), and colours too close to one already picked are skipped.
 */
export async function paletteOf(buf: Buffer): Promise<string[]> {
  const { data, info } = await sharp(buf).rotate().resize(64, 64, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b;
    buckets.set(k, e);
  }
  const list = Array.from(buckets.values()).map((e) => {
    const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const weight = mx > 235 && mn > 220 ? 0.25 : mx < 28 ? 0.35 : 1;
    return { r, g, b, score: e.n * weight * (0.6 + (mx - mn) / 255) };
  }).sort((a, b) => b.score - a.score);
  const out: { r: number; g: number; b: number }[] = [];
  for (const c of list) {
    if (out.some((o) => Math.hypot(o.r - c.r, o.g - c.g, o.b - c.b) < 64)) continue;
    out.push(c);
    if (out.length === 3) break;
  }
  return out.map((c) => toHex(c.r, c.g, c.b));
}

/** Palette and the pill colour it gives, for one preview URL. null when the image can't be read. */
export async function artPalette(imageUrl: string): Promise<{ palette: string[]; accent: string | null } | null> {
  const buf = await readPreview(imageUrl);
  if (!buf) return null;
  try {
    const palette = await paletteOf(buf);
    return { palette, accent: matchAccent(palette) };
  } catch {
    return null;
  }
}

/** A small square JPEG of the painting as a data: URI, for printing the thumbnail extra. */
export async function artThumb(art: Pick<ArtInfo, "imageUrl">, px = 360): Promise<string | null> {
  const buf = await readPreview(art.imageUrl);
  if (!buf) return null;
  try {
    const jpg = await sharp(buf).rotate().resize(px, px, { fit: "cover" }).jpeg({ quality: 82 }).toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}
