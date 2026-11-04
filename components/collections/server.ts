// Server-only helpers for artist collections (Studio API + public pages).
import slugify from "slugify";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const TITLE_MAX = 80;
export const DESC_MAX = 600;

export const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

/** Signed-in artist id, or null. */
export async function artistId() {
  const u = await getUserFromCookie();
  if (!u?.id) return null;
  const a = await prisma.artist.findUnique({ where: { id: u.id }, select: { id: true } });
  return a?.id ?? null;
}

/** A slug unique among this artist's collections (ignoring `exceptId`). */
export async function uniqueSlug(artist: string, title: string, exceptId?: string) {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 60) || "collection";
  const taken = new Set(
    (await prisma.collection.findMany({ where: { artistId: artist, slug: { startsWith: base }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { slug: true } })).map((c) => c.slug),
  );
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
}

export const studioCollectionSelect = {
  id: true, title: true, slug: true, description: true, coverArtworkId: true, position: true,
  items: { orderBy: { position: "asc" as const }, select: { artworkId: true } },
};

export async function listStudioCollections(artist: string) {
  const rows = await prisma.collection.findMany({ where: { artistId: artist }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: studioCollectionSelect });
  return rows.map(shapeStudio);
}

export function shapeStudio(c: { id: string; title: string; slug: string; description: string | null; coverArtworkId: string | null; position: number; items: { artworkId: string }[] }) {
  return { id: c.id, title: c.title, slug: c.slug, description: c.description ?? "", coverArtworkId: c.coverArtworkId, artworkIds: c.items.map((i) => i.artworkId) };
}
export type StudioCollection = ReturnType<typeof shapeStudio>;
