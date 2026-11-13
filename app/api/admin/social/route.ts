// POST /api/admin/social { kind: artwork|collection|event|artist, artistId, artworkId?, collectionId?, eventId?, headline?, preset?, format? }
// "Promote": adds a draft post to the queue for any artwork, collection, event or artist (e.g. "Artist of the week").
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { readSocialSettings } from "@/lib/social/settings";
import { captionFor, materialFor, nextPosition, presetForPost } from "@/lib/social/content";
import { isFormat, isPreset, presetOf } from "@/lib/social/presets";
import { bad, json } from "./_lib";

export const dynamic = "force-dynamic";

const KINDS = ["artwork", "collection", "event", "artist"] as const;

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const kind = String(b?.kind ?? "");
  if (!b || !(KINDS as readonly string[]).includes(kind)) return bad("Pick what to promote: a piece, a collection, an event or an artist.");
  const artistId = String(b.artistId ?? "");
  const artist = artistId ? await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, socialFeature: true, closedAt: true, suspendedAt: true, artist_name: true, name: true } }) : null;
  if (!artist || artist.closedAt || artist.suspendedAt) return bad("Pick an artist.", "artist_not_found", 404);
  if (!artist.socialFeature) return bad(`${artist.artist_name || artist.name} turned off "feature my work on Artfinity's social accounts".`, "no_consent", 409);

  let artworkIds: string[] = [];
  let collectionId: string | null = null, eventId: string | null = null;
  if (kind === "artwork") {
    const a = await prisma.artwork.findFirst({ where: { id: String(b.artworkId ?? ""), artistId, status: "APPROVED", slug: { not: null } }, select: { id: true } });
    if (!a) return bad("That piece isn't approved or was removed. Pick another.", "art_not_found", 404);
    artworkIds = [a.id];
  } else if (kind === "collection") {
    const c = await prisma.collection.findFirst({ where: { id: String(b.collectionId ?? ""), artistId }, select: { id: true, items: { select: { artwork: { select: { id: true, status: true, slug: true } } }, orderBy: { position: "asc" } } } });
    if (!c) return bad("That collection was removed. Pick another.", "collection_not_found", 404);
    collectionId = c.id;
    artworkIds = c.items.map((i) => i.artwork).filter((a) => a.status === "APPROVED" && a.slug).map((a) => a.id).slice(0, 8);
    if (!artworkIds.length) return bad("That collection has no approved pieces yet.", "no_approved_art");
  } else {
    if (kind === "event") {
      const e = await prisma.studioEvent.findFirst({ where: { id: String(b.eventId ?? ""), artistId }, select: { id: true } });
      if (!e) return bad("That event was removed. Pick another.", "event_not_found", 404);
      eventId = e.id;
    }
    const arts = await prisma.artwork.findMany({ where: { artistId, status: "APPROVED", slug: { not: null } }, select: { id: true }, orderBy: { createdAt: "desc" }, take: kind === "artist" ? 6 : 1 });
    if (!arts.length) return bad("This artist has no approved pieces yet.", "no_approved_art");
    artworkIds = arts.map((a) => a.id);
  }

  const s = await readSocialSettings();
  const preset = isPreset(b.preset) && (presetOf(b.preset).pieces === "one" || artworkIds.length > 1) ? b.preset : presetForPost(kind, artworkIds.length, s.presets);
  const headline = typeof b.headline === "string" && b.headline.trim() ? b.headline.trim().slice(0, 80) : kind === "artist" ? "Artist of the week" : null;
  const m = await materialFor({ kind, artistId, artworkIds, collectionId, eventId, headline });
  const post = await prisma.socialPost.create({
    data: {
      status: "draft", kind, source: "manual", artistId, artworkId: artworkIds[0] ?? null, artworkIds, collectionId, eventId, headline, preset,
      format: isFormat(b.format) ? b.format : s.format, caption: captionFor(m, s), position: await nextPosition(), createdById: admin.id,
    },
    select: { id: true },
  });
  await logAdminAction(admin, "social.promote", { type: "social", id: post.id }, `Promoted ${kind} “${m.title}” by ${m.artist?.name ?? "?"} (${presetOf(preset).name})`, { kind, artistId, artworkIds, collectionId, eventId });
  return json({ id: post.id, message: `Added “${m.title}” to the queue` }, 201);
}
