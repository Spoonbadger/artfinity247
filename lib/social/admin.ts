// Data for /admin/social and its API routes. Server only.
import { prisma } from "@/lib/prisma";
import { readSocialSettings, type SocialSettings } from "@/lib/social/settings";
import { autoQueueNewArt, materialFor, scaleScene, type PostMaterial } from "@/lib/social/content";
import { nextSlots } from "@/lib/social/schedule";
import { seasonFor, type PresetId, type VideoFormat } from "@/lib/social/presets";

export const QUEUE = ["draft", "approved", "posting"] as const;
export const HISTORY = ["posted", "failed", "skipped"] as const;

export type AdminPost = {
  id: string;
  status: string;
  kind: string;
  source: string;
  preset: PresetId;
  format: VideoFormat;
  caption: string;
  headline: string | null;
  position: number;
  mediaUrl: string | null;
  mediaType: string | null;
  scheduledFor: string | null;
  postedAt: string | null;
  postedBy: string | null;
  permalink: string | null;
  error: string | null;
  errorCode: string | null;
  createdAt: string;
  material: PostMaterial;
  /** For the countdown preset: the event's start date. */
  dropDate: string | null;
};

const postSelect = {
  id: true, status: true, kind: true, source: true, preset: true, format: true, caption: true, headline: true, position: true, mediaUrl: true, mediaType: true,
  scheduledFor: true, postedAt: true, postedBy: true, permalink: true, error: true, errorCode: true, createdAt: true,
  artistId: true, artworkIds: true, collectionId: true, eventId: true,
} as const;

type Row = Awaited<ReturnType<typeof rowsOf>>[number];
const rowsOf = (where: object, take: number, orderBy: object | object[]) => prisma.socialPost.findMany({ where, select: postSelect, take, orderBy });

async function shape(r: Row): Promise<AdminPost> {
  const material = await materialFor(r);
  let dropDate: string | null = null;
  if (r.eventId) dropDate = (await prisma.studioEvent.findUnique({ where: { id: r.eventId }, select: { start: true } }))?.start ?? null;
  return {
    id: r.id, status: r.status, kind: r.kind, source: r.source, preset: r.preset as PresetId, format: r.format as VideoFormat, caption: r.caption, headline: r.headline,
    position: r.position, mediaUrl: r.mediaUrl, mediaType: r.mediaType, scheduledFor: r.scheduledFor?.toISOString() ?? null, postedAt: r.postedAt?.toISOString() ?? null,
    postedBy: r.postedBy, permalink: r.permalink, error: r.error, errorCode: r.errorCode, createdAt: r.createdAt.toISOString(), material, dropDate,
  };
}

export async function loadSocialPage() {
  const settings = await readSocialSettings();
  // drafts for art approved since the last cron run show up right away
  await autoQueueNewArt(settings).catch((e) => console.error("[social] auto-queue", e));
  const [queueRows, historyRows] = await Promise.all([
    rowsOf({ status: { in: [...QUEUE] } }, 60, [{ position: "asc" }, { createdAt: "asc" }]),
    rowsOf({ status: { in: [...HISTORY] } }, 40, { updatedAt: "desc" }),
  ]);
  const [queue, history] = await Promise.all([Promise.all(queueRows.map(shape)), Promise.all(historyRows.map(shape))]);
  // approved posts first in schedule order, then drafts by position
  queue.sort((a, b) => rank(a) - rank(b) || (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? "") || a.position - b.position);
  return { settings, queue, history, promote: await promoteOptions(), scale: scaleScene(), season: seasonFor() };
}
const rank = (p: AdminPost) => (p.status === "posting" ? 0 : p.status === "approved" ? 1 : 2);

/** Artists (who allow features) with approved art, their collections and coming events, for "Promote". */
export async function promoteOptions() {
  const today = new Date().toISOString().slice(0, 10);
  const artists = await prisma.artist.findMany({
    where: { socialFeature: true, closedAt: null, suspendedAt: null, artworks: { some: { status: "APPROVED", slug: { not: null } } } },
    select: {
      id: true, slug: true, artist_name: true, name: true,
      artworks: { where: { status: "APPROVED", slug: { not: null } }, select: { id: true, title: true }, orderBy: { createdAt: "desc" }, take: 30 },
      collections: { select: { id: true, title: true, _count: { select: { items: true } } }, orderBy: { position: "asc" } },
      events: { where: { end: { gte: today } }, select: { id: true, name: true, start: true }, orderBy: { start: "asc" }, take: 10 },
    },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return artists.map((a) => ({
    id: a.id, name: a.artist_name || a.name, slug: a.slug,
    artworks: a.artworks,
    collections: a.collections.filter((c) => c._count.items > 0).map((c) => ({ id: c.id, title: c.title, count: c._count.items })),
    events: a.events,
  }));
}
export type PromoteOptions = Awaited<ReturnType<typeof promoteOptions>>;

/** Slots for every approved, unposted post in queue order (after an approve or a reorder). */
export async function reschedule(s: SocialSettings, now = new Date()) {
  const posted = await prisma.socialPost.findMany({ where: { OR: [{ status: "posted", postedAt: { gte: new Date(now.getTime() - 2 * 86_400_000) } }, { status: "posting" }] }, select: { postedAt: true, scheduledFor: true } });
  const taken = posted.map((p) => p.postedAt ?? p.scheduledFor).filter(Boolean) as Date[];
  const approved = await prisma.socialPost.findMany({ where: { status: "approved" }, orderBy: [{ position: "asc" }, { approvedAt: "asc" }], select: { id: true, scheduledFor: true } });
  // a post already due keeps its time (the cron picks it up next); the rest get fresh slots in order
  const due = approved.filter((p) => p.scheduledFor && p.scheduledFor.getTime() <= now.getTime());
  const rest = approved.filter((p) => !due.includes(p));
  const slots = nextSlots({ now, times: s.times, maxPerDay: s.maxPerDay, taken: [...taken, ...due.map((p) => p.scheduledFor as Date)], count: rest.length });
  await Promise.all(rest.map((p, i) => prisma.socialPost.update({ where: { id: p.id }, data: { scheduledFor: slots[i] ?? null } })));
}
