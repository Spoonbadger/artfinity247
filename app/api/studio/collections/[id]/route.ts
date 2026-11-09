// PATCH {title?, description?, coverArtworkId?, artworkIds?}: edit one collection.
//   artworkIds is the full, ordered list of pieces (replaces what's there).
// DELETE: remove it (the artworks themselves stay).
import { prisma } from "@/lib/prisma";
import { safe, DESC_MAX, json, shapeStudio, studioCollectionSelect, TITLE_MAX } from "@/components/collections/server";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function own(id: string) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return { denied, me: null, col: null };
  const me = user.id;
  const col = await prisma.collection.findFirst({ where: { id, artistId: me }, select: { id: true, coverArtworkId: true } });
  return { denied: null, me, col };
}

export const PATCH = safe(async (req: Request, { params }: { params: { id: string } }) => {
  const { denied, me, col } = await own(params.id);
  if (denied) return denied;
  if (!col) return json({ error: "That collection is gone. Refresh to see your list.", code: "collection_not_found" }, 404);
  const body = await req.json().catch(() => ({}));
  const data: { title?: string; description?: string; coverArtworkId?: string | null } = {};

  // The slug stays put on rename, so links people already shared keep working.
  if (body.title !== undefined) {
    const title = String(body.title).replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
    if (!title) return json({ error: "Give it a name.", code: "title_required" }, 400);
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description).trim().slice(0, DESC_MAX);

  let ids: string[] | null = null;
  if (Array.isArray(body.artworkIds)) {
    ids = Array.from(new Set(body.artworkIds.map(String))).slice(0, 200) as string[];
    const ok = await prisma.artwork.count({ where: { id: { in: ids }, artistId: me } });
    if (ok !== ids.length) return json({ error: "Only your own pieces can go in a collection.", code: "not_your_art" }, 400);
  }
  if (body.coverArtworkId !== undefined) {
    const cover = body.coverArtworkId ? String(body.coverArtworkId) : null;
    if (cover && !(await prisma.artwork.count({ where: { id: cover, artistId: me } }))) return json({ error: "Only your own pieces can go in a collection.", code: "not_your_art" }, 400);
    data.coverArtworkId = cover;
  }
  // A cover that was taken out of the collection falls back to the first piece.
  if (ids) {
    const cover = data.coverArtworkId !== undefined ? data.coverArtworkId : col.coverArtworkId;
    if (cover && !ids.includes(cover)) data.coverArtworkId = ids[0] ?? null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (ids) {
      await tx.collectionItem.deleteMany({ where: { collectionId: col.id } });
      if (ids.length) await tx.collectionItem.createMany({ data: ids.map((artworkId, position) => ({ collectionId: col.id, artworkId, position })) });
    }
    return tx.collection.update({ where: { id: col.id }, data, select: studioCollectionSelect });
  });
  return json({ collection: shapeStudio(updated) });
});

export const DELETE = safe(async (_req: Request, { params }: { params: { id: string } }) => {
  const { denied, col } = await own(params.id);
  if (denied) return denied;
  if (!col) return json({ error: "That collection is gone. Refresh to see your list.", code: "collection_not_found" }, 404);
  await prisma.collection.delete({ where: { id: col.id } });
  return json({ ok: true });
});
