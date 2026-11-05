// What goes in a social post: the pieces, the caption (template + the artist's @handle credit), the scale scene for
// "Size compare", and the auto-queue sweep that drafts a post for each newly approved piece. Server only.
import { prisma } from "@/lib/prisma";
import { SITE_URL, artUrl, artistUrl, collectionUrl } from "@/lib/urls";
import { basePrices } from "@/lib/artwork_price";
import { loadCatalog, variantForScene } from "@/lib/scenes/catalog";
import { REF_KINDS } from "@/lib/scenes/types";
import { presetOf, type PresetId } from "@/lib/social/presets";
import type { SocialSettings } from "@/lib/social/settings";

export const dollars = (cents: number) => "$" + (cents / 100).toFixed(2);
export const fromCents = (markupSmall: number | null | undefined) => basePrices.small + (markupSmall || 0);

/** The artist's Instagram @handle from their links page or verification request, or null. */
export async function instagramHandles(artistIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!artistIds.length) return out;
  const [links, artists] = await Promise.all([
    prisma.artistLink.findMany({ where: { artistId: { in: artistIds }, active: true, OR: [{ kind: "instagram" }, { url: { contains: "instagram.com" } }] }, select: { artistId: true, url: true }, orderBy: { position: "asc" } }),
    prisma.artist.findMany({ where: { id: { in: artistIds } }, select: { id: true, verificationEvidence: true } }),
  ]);
  const clean = (v: string) => {
    const m = v.trim().replace(/^@/, "").match(/^(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/)?([A-Za-z0-9._]{1,30})\/?/);
    return m && !["p", "reel", "explore", "accounts"].includes(m[1]) ? `@${m[1]}` : null;
  };
  for (const a of artists) {
    const ev = a.verificationEvidence as { instagram?: unknown } | null;
    const h = typeof ev?.instagram === "string" ? clean(ev.instagram) : null;
    if (h) out.set(a.id, h);
  }
  for (const l of links) { const h = clean(l.url); if (h && !out.has(l.artistId)) out.set(l.artistId, h); }
  return out;
}

export type CaptionFields = { title: string; artist: string; handle: string; price: string; link: string };
export function fillCaption(template: string, f: CaptionFields, hashtags: string) {
  const body = template.replace(/\{(title|artist|handle|price|link)\}/g, (_, k: keyof CaptionFields) => f[k]).trim();
  return (hashtags.trim() ? `${body}\n\n${hashtags.trim()}` : body).slice(0, 2200);
}

const artistName = (a: { artist_name: string | null; name: string; first_name?: string | null; last_name?: string | null }) =>
  a.artist_name || [a.first_name, a.last_name].filter(Boolean).join(" ") || a.name;

/**
 * Photo scene for "Size compare": one whose reference object (a person, a sofa…) gives the scale, with a line about it.
 * Null when photo scenes aren't built (the video then uses a drawn living room with a sofa).
 */
export function scaleScene(seed = 0): { n: number; note: string } | null {
  const c = loadCatalog();
  if (!c) return null;
  const rank = ["adult", "seated", "sofa", "door", "table", "counter", "chair"];
  let best: { n: number; r: number; kind: string; inches: number } | null = null;
  for (let i = 0; i < 1000; i++) {
    const n = (i + seed) % 1000;
    const hit = variantForScene(c, n);
    if (!hit || hit.photo.ann.status === "rejected") continue;
    const ref = hit.photo.ann.ref;
    const r = rank.indexOf(ref.kind);
    if (r >= 0 && (!best || r < best.r)) best = { n, r, kind: ref.kind, inches: ref.inches };
    if (best?.r === 0) break;
  }
  if (!best) return null;
  const label = REF_KINDS.find((k) => k.key === best!.kind)?.label ?? "Reference";
  return { n: best.n, note: `For scale: ${label.toLowerCase()}, about ${Math.round(best.inches)} in` };
}

/** Everything the admin's browser needs to render a post's video, and the caption fields. */
export type PostPiece = { id: string; slug: string; title: string; fromCents: number; roomScenes: number[] };
export type PostMaterial = {
  pieces: PostPiece[];
  artist: { id: string; name: string; slug: string; handle: string | null; consent: boolean } | null;
  link: string;
  title: string;
};

const pieceSelect = { id: true, slug: true, title: true, markupSmall: true, roomScenes: true, status: true, artistId: true } as const;
type PieceRow = { id: string; slug: string | null; title: string; markupSmall: number | null; roomScenes: number[]; status: string; artistId: string };
const toPiece = (r: PieceRow): PostPiece => ({ id: r.id, slug: r.slug as string, title: r.title, fromCents: fromCents(r.markupSmall), roomScenes: r.roomScenes });

export async function materialFor(p: { kind: string; artistId: string | null; artworkIds: string[]; collectionId: string | null; eventId: string | null; headline: string | null }): Promise<PostMaterial> {
  const artistRow = p.artistId
    ? await prisma.artist.findUnique({ where: { id: p.artistId }, select: { id: true, slug: true, artist_name: true, name: true, first_name: true, last_name: true, socialFeature: true } })
    : null;
  const handles = await instagramHandles(artistRow ? [artistRow.id] : []);
  const artist = artistRow ? { id: artistRow.id, name: artistName(artistRow), slug: artistRow.slug, handle: handles.get(artistRow.id) ?? null, consent: artistRow.socialFeature } : null;
  let rows: PieceRow[] = [];
  if (p.artworkIds.length) {
    const found = (await prisma.artwork.findMany({ where: { id: { in: p.artworkIds }, status: "APPROVED", slug: { not: null } }, select: pieceSelect })) as PieceRow[];
    rows = p.artworkIds.map((id) => found.find((f) => f.id === id)).filter(Boolean) as PieceRow[];
  }
  const pieces = rows.map(toPiece);
  let link = artist ? artistUrl(artist.slug, SITE_URL) : SITE_URL;
  let title = pieces[0]?.title ?? p.headline ?? "";
  if (p.kind === "artwork" && artist && pieces[0]) link = `${artUrl(artist.slug, pieces[0].slug, SITE_URL)}?src=instagram`;
  if (p.kind === "collection" && p.collectionId && artist) {
    const c = await prisma.collection.findUnique({ where: { id: p.collectionId }, select: { slug: true, title: true } });
    if (c) { link = collectionUrl(artist.slug, c.slug, SITE_URL); title = c.title; }
  }
  if (p.kind === "event" && p.eventId) {
    const e = await prisma.studioEvent.findUnique({ where: { id: p.eventId }, select: { name: true } });
    if (e) title = e.name;
  }
  if (p.kind === "artist" && artist) title = p.headline || `Artist of the week: ${artist.name}`;
  return { pieces, artist, link, title };
}

export function captionFor(m: PostMaterial, s: Pick<SocialSettings, "captionTemplate" | "hashtags">) {
  const cheapest = m.pieces.length ? Math.min(...m.pieces.map((x) => x.fromCents)) : basePrices.small;
  return fillCaption(s.captionTemplate, {
    title: m.title,
    artist: m.artist?.name ?? "",
    handle: m.artist?.handle ?? m.artist?.name ?? "",
    price: dollars(cheapest),
    link: m.link,
  }, s.hashtags);
}

/** Presets that work for a kind of post: walks and carousels need several pieces. */
export function presetForPost(kind: string, pieces: number, allowed: PresetId[], turn = 0): PresetId {
  const fits = allowed.filter((id) => (presetOf(id).pieces === "many" ? pieces > 1 : true));
  if (kind === "collection" || kind === "artist") {
    const many = fits.filter((id) => presetOf(id).pieces === "many");
    if (pieces > 1) return many[turn % Math.max(1, many.length)] ?? "carousel";
  }
  if (kind === "event") return fits.includes("countdown") ? "countdown" : fits[0] ?? "price-card";
  const one = fits.filter((id) => presetOf(id).pieces === "one");
  return one[turn % Math.max(1, one.length)] ?? "room-tour";
}

/** Next position at the end of the queue. */
export async function nextPosition() {
  const last = await prisma.socialPost.findFirst({ where: { status: { in: ["draft", "approved"] } }, orderBy: { position: "desc" }, select: { position: true } });
  return (last?.position ?? 0) + 1;
}

/**
 * Auto-queue: a draft for each piece approved since auto-queue was turned on, whose artist allows features and that
 * has no post yet. Safe to run often (the cron and the admin page both run it).
 */
export async function autoQueueNewArt(s: SocialSettings, now = new Date()): Promise<{ queued: number }> {
  if (!s.autoQueue) return { queued: 0 };
  // never saved yet: start with the last 3 days, so turning it on doesn't draft the whole catalog
  const since = s.autoQueueSince ? new Date(s.autoQueueSince) : new Date(now.getTime() - 3 * 86_400_000);
  const approvals = await prisma.adminAction.findMany({ where: { action: "artwork.approve", createdAt: { gte: since } }, select: { targetId: true }, take: 500 });
  const approvedIds = approvals.map((a) => a.targetId).filter(Boolean) as string[];
  const arts = await prisma.artwork.findMany({
    where: {
      status: "APPROVED",
      slug: { not: null },
      OR: [{ createdAt: { gte: since } }, { id: { in: approvedIds } }],
      artist: { socialFeature: true, closedAt: null, suspendedAt: null },
    },
    select: { id: true, artistId: true, title: true },
    orderBy: { createdAt: "asc" },
    take: 50,
  });
  if (!arts.length) return { queued: 0 };
  const have = new Set((await prisma.socialPost.findMany({ where: { artworkId: { in: arts.map((a) => a.id) } }, select: { artworkId: true } })).map((p) => p.artworkId));
  const fresh = arts.filter((a) => !have.has(a.id));
  let pos = await nextPosition();
  let turn = await prisma.socialPost.count({ where: { source: "auto" } });
  for (const a of fresh) {
    const preset = presetForPost("artwork", 1, s.presets, turn++);
    const m = await materialFor({ kind: "artwork", artistId: a.artistId, artworkIds: [a.id], collectionId: null, eventId: null, headline: null });
    await prisma.socialPost.create({
      data: { status: "draft", kind: "artwork", source: "auto", artistId: a.artistId, artworkId: a.id, artworkIds: [a.id], preset, format: s.format, caption: captionFor(m, s), position: pos++, createdAt: now },
    });
  }
  return { queued: fresh.length };
}
