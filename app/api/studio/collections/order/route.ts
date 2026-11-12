// POST {ids: string[]}: the artist's collections in their new order.
import { prisma } from "@/lib/prisma";
import { safe, json } from "@/components/collections/server";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const POST = safe(async (req: Request) => {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const me = user.id;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.map(String) : [];
  const mine = await prisma.collection.findMany({ where: { artistId: me }, select: { id: true } });
  const own = new Set(mine.map((c) => c.id));
  if (ids.length !== own.size || !ids.every((id) => own.has(id))) return json({ error: "Your collections changed in another tab. Refresh and try again.", code: "stale" }, 400);
  await prisma.$transaction(ids.map((id, position) => prisma.collection.update({ where: { id }, data: { position } })));
  return json({ ok: true });
});
