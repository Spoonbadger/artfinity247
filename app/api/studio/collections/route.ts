// GET: the signed-in artist's collections. POST {title, description?}: create one at the end.
import { prisma } from "@/lib/prisma";
import { artistId, safe, DESC_MAX, json, listStudioCollections, shapeStudio, studioCollectionSelect, TITLE_MAX, uniqueSlug } from "@/components/collections/server";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = safe(async () => {
  const me = await artistId();
  if (!me) return json({ error: "Log in to keep going.", code: "not_logged_in" }, 401);
  return json({ collections: await listStudioCollections(me) });
});

export const POST = safe(async (req: Request) => {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const me = user.id;
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
  if (!title) return json({ error: "Give it a name.", code: "title_required" }, 400);
  const description = String(body?.description ?? "").trim().slice(0, DESC_MAX);
  const count = await prisma.collection.count({ where: { artistId: me } });
  if (count >= 50) return json({ error: "That's 50 collections, the most you can have. Delete one to add another.", code: "collection_limit" }, 400);
  const last = await prisma.collection.findFirst({ where: { artistId: me }, orderBy: { position: "desc" }, select: { position: true } });
  const created = await prisma.collection.create({
    data: { artistId: me, title, description, slug: await uniqueSlug(me, title), position: (last?.position ?? -1) + 1 },
    select: studioCollectionSelect,
  });
  return json({ collection: shapeStudio(created) }, 201);
});
