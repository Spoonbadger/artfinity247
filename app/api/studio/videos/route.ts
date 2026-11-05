// GET   /api/studio/videos  What the Share kit's Videos section needs beyond the piece list: room picks, collections,
//                           coming events, the scale scene for "Size compare", the profile photo (logo outro) and the
//                           "feature my work on Artfinity's social accounts" setting.
// PATCH /api/studio/videos { socialFeature: boolean }  Saves that setting (the /admin/social queue respects it).
import { prisma } from "@/lib/prisma";
import { artistId, json, safe } from "@/components/collections/server";
import { scaleScene } from "@/lib/social/content";
import { isProActive } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const GET = safe(async () => {
  const me = await artistId();
  if (!me) return json({ error: "Log in to keep going.", code: "not_logged_in" }, 401);
  const today = new Date().toISOString().slice(0, 10);
  const [artist, art, collections, events] = await Promise.all([
    prisma.artist.findUnique({ where: { id: me }, select: { socialFeature: true, profileImage: true, proUntil: true } }),
    prisma.artwork.findMany({ where: { artistId: me, status: "APPROVED", slug: { not: null } }, select: { slug: true, roomScenes: true } }),
    prisma.collection.findMany({
      where: { artistId: me },
      select: { id: true, title: true, items: { select: { artwork: { select: { slug: true, status: true } } }, orderBy: { position: "asc" } } },
      orderBy: { position: "asc" },
    }),
    prisma.studioEvent.findMany({ where: { artistId: me, end: { gte: today } }, select: { id: true, name: true, start: true }, orderBy: { start: "asc" }, take: 10 }),
  ]);
  return json({
    socialFeature: artist?.socialFeature ?? true,
    pro: isProActive(artist),
    profileImage: artist?.profileImage || null,
    roomScenes: Object.fromEntries(art.map((a) => [a.slug as string, a.roomScenes])),
    collections: collections
      .map((c) => ({ id: c.id, title: c.title, slugs: c.items.filter((i) => i.artwork.status === "APPROVED" && i.artwork.slug).map((i) => i.artwork.slug as string) }))
      .filter((c) => c.slugs.length),
    events,
    scale: scaleScene(),
  });
});

export const PATCH = safe(async (req: Request) => {
  const me = await artistId();
  if (!me) return json({ error: "Log in to keep going.", code: "not_logged_in" }, 401);
  const b = (await req.json().catch(() => ({}))) as { socialFeature?: unknown };
  if (typeof b.socialFeature !== "boolean") return json({ error: "Nothing to save.", code: "invalid_input" }, 400);
  await prisma.artist.update({ where: { id: me }, data: { socialFeature: b.socialFeature } });
  if (!b.socialFeature) {
    // drafts waiting in Artfinity's queue are dropped right away; posted ones stay up
    await prisma.socialPost.updateMany({ where: { artistId: me, status: { in: ["draft", "approved"] } }, data: { status: "skipped", error: "The artist turned off social features.", errorCode: "consent", scheduledFor: null } });
  }
  return json({ socialFeature: b.socialFeature });
});
