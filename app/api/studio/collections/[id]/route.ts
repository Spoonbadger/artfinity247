// PATCH {title?, description?, coverArtworkId?, artworkIds?}: edit one collection.
//   artworkIds is the full, ordered list of pieces (replaces what's there).
// DELETE: remove it (the artworks themselves stay).
import { prisma } from "@/lib/prisma";
import { artistId, DESC_MAX, json, shapeStudio, studioCollectionSelect, TITLE_MAX } from "@/components/collections/server";

export const dynamic = "force-dynamic";

async function own(id: string) {
  const me = await artistId();
  if (!me) return { me: null, col: null };
  const col = await prisma.collection.findFirst({ where: { id, artistId: me }, select: { id: true, coverArtworkId: true } });
  return { me, col };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { me, col } = await own(params.id);
  if (!me) return json({ error: "Log in first." }, 401);
  if (!col) return json({ error: "Not found" }, 404);
  const body = await req.json().catch(() => ({}));
  const data: { title?: string; description?: string; coverArtworkId?: string | null } = {};

  // The slug stays put on rename, so links people already shared keep working.
  if (body.title !== undefined) {
    const title = String(body.title).replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
    if (!title) return json({ error: "Give it a name." }, 400);
    data.title = title;
  }
  if (body.description !== undefined) data.description = String(body.description).trim().slice(0, DESC_MAX);

  let ids: string[] | null = null;
  if (Array.isArray(body.artworkIds)) {
    ids = Array.from(new Set(body.artworkIds.map(String))).slice(0, 200) as string[];
    const ok = await prisma.artwork.count({ where: { id: { in: ids }, artistId: me } });
    if (ok !== ids.length) return json({ error: "Only your own pieces." }, 400);
  }
  if (body.coverArtworkId !== undefined) {
    const cover = body.coverArtworkId ? String(body.coverArtworkId) : null;
    if (cover && !(await prisma.artwork.count({ where: { id: cover, artistId: me } }))) return json({ error: "Only your own pieces." }, 400);
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
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { me, col } = await own(params.id);
  if (!me) return json({ error: "Log in first." }, 401);
  if (!col) return json({ error: "Not found" }, 404);
  await prisma.collection.delete({ where: { id: col.id } });
  return json({ ok: true });
}
