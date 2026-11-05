// Sending newsletters to confirmed followers. Server only.
import { prisma } from "@/lib/prisma";
import { emailEnabled, resend } from "@/lib/resend";
import { artUrl, artistUrl, SITE_URL } from "@/lib/urls";
import { safeFromName } from "@/lib/artistEmails.server";
import { activeWhere, artistDisplayName, FROM_ADDRESS, unsubscribeHeaders, unsubscribeUrl } from "@/lib/followers";
import { MAX_ARTWORKS, renderNewsletter, SEND_GAP_MS, type NewsletterArt } from "@/lib/newsletter";

const BASE = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, "");
const BATCH = 50;

type Sender = { id: string; slug: string | null; artist_name: string | null; name: string; profileImage: string | null; email: string };

export const tracked = (url: string) => `${url}?utm_source=newsletter&utm_medium=email`;

/** The artist's own approved pieces, in the order picked. */
export async function newsletterArtworks(artist: { id: string; slug: string | null }, ids: string[]): Promise<NewsletterArt[]> {
  if (!ids.length || !artist.slug) return [];
  const rows = await prisma.artwork.findMany({
    where: { id: { in: ids.slice(0, MAX_ARTWORKS) }, artistId: artist.id, status: "APPROVED", slug: { not: null } },
    select: { id: true, slug: true, title: true, imageUrl: true },
  });
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter(Boolean)
    .map((r) => ({ title: r!.title, imageUrl: r!.imageUrl, url: tracked(artUrl(artist.slug!, r!.slug!, BASE)) }));
}

function render(artist: Sender, n: { subject: string; body: string }, artworks: NewsletterArt[], unsubscribe: string) {
  return renderNewsletter({
    artistName: artistDisplayName(artist),
    avatar: artist.profileImage,
    artistUrl: tracked(artistUrl(artist.slug || "", BASE)),
    subject: n.subject,
    body: n.body,
    artworks,
    unsubscribe,
    base: BASE,
  });
}

const fromFor = (artist: Sender) => `${safeFromName(artistDisplayName(artist))} via Artfinity <${FROM_ADDRESS}>`;

export async function sendTestNewsletter(artist: Sender, n: { subject: string; body: string; artworkIds: string[] }) {
  const artworks = await newsletterArtworks(artist, n.artworkIds);
  const { html, text } = render(artist, n, artworks, `${BASE}/studio/followers`);
  const { error } = await resend.emails.send({ from: fromFor(artist), to: artist.email, subject: `[Test] ${n.subject}`, html, text });
  if (error) throw error;
}

/** When the artist may send again (null = now). */
export async function nextSendAt(artistId: string) {
  const last = await prisma.newsletter.findFirst({ where: { artistId, sentAt: { not: null } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
  if (!last?.sentAt) return null;
  const next = new Date(last.sentAt.getTime() + SEND_GAP_MS);
  return next > new Date() ? next : null;
}

export class SendTooSoonError extends Error {
  constructor(public next: Date) { super("One newsletter a day."); }
}

/**
 * Sends a saved newsletter to every confirmed, subscribed follower, in batches.
 * Claims sentAt first so a double click or a second tab can't send twice in a day.
 */
export async function sendNewsletter(artist: Sender, newsletterId: string) {
  const since = new Date(Date.now() - SEND_GAP_MS);
  const claimed = await prisma.$transaction(async (tx) => {
    // Lock the artist row so two sends can't both pass the daily check.
    await tx.$queryRaw`SELECT id FROM "Artist" WHERE id = ${artist.id} FOR UPDATE`;
    const recent = await tx.newsletter.findFirst({ where: { artistId: artist.id, sentAt: { gt: since } }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
    if (recent?.sentAt) throw new SendTooSoonError(new Date(recent.sentAt.getTime() + SEND_GAP_MS));
    const r = await tx.newsletter.updateMany({ where: { id: newsletterId, artistId: artist.id, sentAt: null }, data: { sentAt: new Date() } });
    return r.count === 1;
  });
  if (!claimed) throw new Error("Already sent.");

  const n = await prisma.newsletter.findUniqueOrThrow({ where: { id: newsletterId } });
  const artworks = await newsletterArtworks(artist, n.artworkIds);
  const followers = await prisma.follower.findMany({ where: activeWhere(artist.id), select: { email: true, token: true }, orderBy: { createdAt: "asc" } });

  let sent = 0;
  for (let i = 0; i < followers.length; i += BATCH) {
    const batch = followers.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(async (f) => {
        const { html, text } = render(artist, n, artworks, unsubscribeUrl(f.token));
        const { error } = await resend.emails.send({ from: fromFor(artist), to: f.email, subject: n.subject, html, text, headers: unsubscribeHeaders(f.token) });
        if (error) throw error;
      }),
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
    results.forEach((r) => r.status === "rejected" && console.error("[newsletter] send failed", r.reason));
    await prisma.newsletter.update({ where: { id: n.id }, data: { recipients: sent } });
  }
  console.log(`[newsletter] ${artist.slug} "${n.subject}" sent to ${sent}/${followers.length}${!emailEnabled && followers[0] ? ` (dev) unsubscribe=${unsubscribeUrl(followers[0].token)}` : ""}`);
  return { sent, total: followers.length };
}
