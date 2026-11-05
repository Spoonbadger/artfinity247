// POST {ids: string[]}: the artist's collections in their new order.
import { prisma } from "@/lib/prisma";
import { artistId, safe, json } from "@/components/collections/server";

export const dynamic = "force-dynamic";

export const POST = safe(async (req: Request) => {
  const me = await artistId();
  if (!me) return json({ error: "Log in to keep going.", code: "not_logged_in" }, 401);
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  const mine = await prisma.collection.findMany({ where: { artistId: me }, select: { id: true } });
  const own = new Set(mine.map((c) => c.id));
  if (ids.length !== own.size || !ids.every((id) => own.has(id))) return json({ error: "Your collections changed in another tab. Refresh and try again.", code: "stale" }, 400);
  await prisma.$transaction(ids.map((id, position) => prisma.collection.update({ where: { id }, data: { position } })));
  return json({ ok: true });
});
