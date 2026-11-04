// GET: the signed-in artist's collections. POST {title, description?}: create one at the end.
import { prisma } from "@/lib/prisma";
import { artistId, DESC_MAX, json, listStudioCollections, shapeStudio, studioCollectionSelect, TITLE_MAX, uniqueSlug } from "@/components/collections/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await artistId();
  if (!me) return json({ error: "Log in first." }, 401);
  return json({ collections: await listStudioCollections(me) });
}

export async function POST(req: Request) {
  const me = await artistId();
  if (!me) return json({ error: "Log in first." }, 401);
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").replace(/\s+/g, " ").trim().slice(0, TITLE_MAX);
  if (!title) return json({ error: "Give it a name." }, 400);
  const description = String(body?.description ?? "").trim().slice(0, DESC_MAX);
  const count = await prisma.collection.count({ where: { artistId: me } });
  if (count >= 50) return json({ error: "Up to 50 collections." }, 400);
  const last = await prisma.collection.findFirst({ where: { artistId: me }, orderBy: { position: "desc" }, select: { position: true } });
  const created = await prisma.collection.create({
    data: { artistId: me, title, description, slug: await uniqueSlug(me, title), position: (last?.position ?? -1) + 1 },
    select: studioCollectionSelect,
  });
  return json({ collection: shapeStudio(created) }, 201);
}
