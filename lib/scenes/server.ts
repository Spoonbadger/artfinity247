// Photo scenes: small server helpers shared by the API routes.
import path from "node:path";
import fsp from "node:fs/promises";
import os from "node:os";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

/** Annotation writes touch the repo's files: allowed in dev, or when SCENES_ADMIN_WRITE=1 on a writable server. */
export const scenesWritable = () => process.env.NODE_ENV !== "production" || process.env.SCENES_ADMIN_WRITE === "1";

/**
 * Where rendered JPEGs are cached. .cache/scenes in the project (dev, self-hosted); on read-only serverless file systems
 * (Vercel) the OS temp dir, which lives as long as the instance. The CDN caches the versioned URLs in production.
 */
let cacheDir: string | null = null;
export async function sceneCacheDir() {
  if (cacheDir) return cacheDir;
  const want = process.env.SCENES_CACHE_DIR || path.join(process.cwd(), ".cache", "scenes");
  for (const dir of [want, path.join(os.tmpdir(), "artfinity-scenes")]) {
    try {
      await fsp.mkdir(dir, { recursive: true });
      await fsp.access(dir, 2 /* W_OK */);
      return (cacheDir = dir);
    } catch {}
  }
  return null;
}

/**
 * The artwork for a render: approved work for anyone; the artist's own (or any, for admins) otherwise, so Studio can
 * preview rooms before approval.
 */
export async function artForRender(slug: string) {
  if (!slug) return null;
  const art = await prisma.artwork.findUnique({ where: { slug }, select: { imageUrl: true, title: true, status: true, artistId: true, sensitive: true, artist: { select: { closedAt: true, suspendedAt: true } } } });
  if (!art) return null;
  if (art.status === "APPROVED" && !art.artist.closedAt && !art.artist.suspendedAt) return art;
  const u = await getUserFromCookie().catch(() => null);
  return u && (u.id === art.artistId || u.role === "ADMIN") ? art : null;
}

/** Artwork image bytes from a stored URL (public file or https), or null. */
export async function readArtImage(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith("/")) {
      const pub = path.join(process.cwd(), "public");
      const file = path.normalize(path.join(pub, decodeURIComponent(url.split("?")[0])));
      if (!file.startsWith(pub + path.sep)) return null;
      return await fsp.readFile(file);
    }
    if (!/^https:\/\//.test(url)) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}
