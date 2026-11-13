// Email followers: an artist's own list. Page follows use double opt-in; ticking the box at checkout
// or importing with consent counts as consent. Server only.
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { emailEnabled, resend } from "@/lib/resend";
import { artistUrl, SITE_URL } from "@/lib/urls";
import { safeFromName } from "@/lib/artistEmails.server";
import { emailFooter, esc } from "@/lib/newsletter";

export const FROM_ADDRESS = "notifications@theartfinity.com";
const BASE = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, "");

export type FollowSource = "page" | "checkout" | "links" | "import";

export const emailSchema = z.string().trim().toLowerCase().email().max(200);
export const newToken = () => randomBytes(24).toString("base64url");

export const confirmUrl = (token: string) => `${BASE}/follow/confirm?t=${encodeURIComponent(token)}`;
export const unsubscribeUrl = (token: string) => `${BASE}/follow/unsubscribe?t=${encodeURIComponent(token)}`;
/** RFC 8058 one-click target for the List-Unsubscribe header (POST or GET). */
export const unsubscribeApiUrl = (token: string) => `${BASE}/api/follow/unsubscribe?t=${encodeURIComponent(token)}`;

export function unsubscribeHeaders(token: string) {
  return {
    "List-Unsubscribe": `<${unsubscribeApiUrl(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export const artistDisplayName = (a: { artist_name?: string | null; name?: string | null }) => a.artist_name || a.name || "the artist";
export const artistFirstName = (a: { first_name?: string | null; artist_name?: string | null; name?: string | null }) =>
  a.first_name || artistDisplayName(a).split(" ")[0];

/** Confirmed and still subscribed: who a newsletter goes to. */
export const activeWhere = (artistId: string) => ({ artistId, confirmedAt: { not: null }, unsubscribedAt: null });

export async function followerCounts(artistId: string) {
  const [confirmed, pending, unsubscribed] = await Promise.all([
    prisma.follower.count({ where: activeWhere(artistId) }),
    prisma.follower.count({ where: { artistId, confirmedAt: null, unsubscribedAt: null } }),
    prisma.follower.count({ where: { artistId, unsubscribedAt: { not: null } } }),
  ]);
  return { confirmed, pending, unsubscribed };
}

type ArtistForEmail = { id: string; slug: string | null; artist_name: string | null; name: string; first_name: string | null };

async function sendConfirmEmail(artist: ArtistForEmail, email: string, token: string) {
  const name = artistDisplayName(artist);
  const first = artistFirstName(artist);
  const link = confirmUrl(token);
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#15161b;max-width:520px;margin:0 auto;padding:24px">` +
    `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b5d66">${esc(name)}</p>` +
    `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.15">Confirm you want new work from ${esc(first)}</h1>` +
    `<p style="margin:0 0 20px">Tap the button and ${esc(first)}'s new paintings will land in your inbox. No more than one email a day, usually far fewer.</p>` +
    `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#8b2a4b;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">Yes, send me new work</a></p>` +
    `<p style="margin:0;font-size:13px;color:#5b5d66">Didn't ask for this? Ignore this email and nothing happens.</p>` +
    emailFooter({ base: BASE }) +
    `</div>`;
  const text = `Confirm you want new work from ${first}\n\n${link}\n\nDidn't ask for this? Ignore this email and nothing happens.`;
  const { error } = await resend.emails.send({
    from: `${safeFromName(name)} via Artfinity <${FROM_ADDRESS}>`,
    to: email,
    subject: `Confirm you want new work from ${first}`,
    html,
    text,
  });
  if (error) throw error;
  // Local dev has no inbox: print the link so the flow can be tested.
  if (!emailEnabled) console.log(`[follow:dev] confirm ${email} -> ${link}`);
}

export type FollowState = "pending" | "following";

/**
 * Follow from the artist page, buy page or links page. Creates the follower (or reuses it) and sends
 * the double opt-in email. `viewerEmail` is the logged-in user's email: only then do we say "following"
 * straight away for an already-confirmed address, so nobody can probe who follows whom.
 */
export async function requestFollow(opts: { artistId: string; email: string; name?: string | null; source: FollowSource; viewerEmail?: string | null }): Promise<FollowState> {
  const artist = await prisma.artist.findUnique({ where: { id: opts.artistId }, select: { id: true, slug: true, artist_name: true, name: true, first_name: true } });
  if (!artist) throw new Error("No artist");
  const existing = await prisma.follower.findUnique({ where: { artistId_email: { artistId: artist.id, email: opts.email } } });
  const active = !!existing?.confirmedAt && !existing.unsubscribedAt;
  if (active && opts.viewerEmail && opts.viewerEmail.toLowerCase() === opts.email) return "following";

  const follower = existing ?? (await prisma.follower.create({
    data: { artistId: artist.id, email: opts.email, name: opts.name || null, source: opts.source, token: newToken() },
  }));
  await sendConfirmEmail(artist, opts.email, follower.token);
  return "pending";
}

/** Ticked "Email me when … posts new work" at checkout: a confirmed follow for each artist in the order. */
export async function followFromCheckout(email: string | null | undefined, artistIds: (string | null | undefined)[], name?: string | null) {
  const parsed = emailSchema.safeParse(email ?? "");
  if (!parsed.success) return 0;
  const ids = Array.from(new Set(artistIds.filter(Boolean) as string[]));
  const now = new Date();
  for (const artistId of ids) {
    await prisma.follower.upsert({
      where: { artistId_email: { artistId, email: parsed.data } },
      create: { artistId, email: parsed.data, name: name || null, source: "checkout", token: newToken(), confirmedAt: now },
      // A fresh tick is fresh consent, even after an earlier unsubscribe.
      update: { confirmedAt: now, unsubscribedAt: null },
    });
  }
  if (ids.length) console.log(`[follow] checkout opt-in ${parsed.data} -> ${ids.length} artist(s)`);
  return ids.length;
}

/** Artists in a paid order (for the checkout opt-in). */
export async function artistIdsForOrder(orderId: string) {
  const items = await prisma.orderItem.findMany({ where: { orderId }, select: { artwork: { select: { artistId: true } } } });
  return items.map((i) => i.artwork?.artistId);
}

const withArtist = { artist: { select: { slug: true, artist_name: true, name: true, first_name: true, profileImage: true } } } as const;

/** Confirm link (and Resubscribe): confirmed, subscribed again. */
export async function confirmFollow(token: string) {
  const f = await prisma.follower.findUnique({ where: { token }, include: withArtist });
  if (!f) return null;
  if (f.confirmedAt && !f.unsubscribedAt) return f;
  return prisma.follower.update({ where: { id: f.id }, data: { confirmedAt: f.confirmedAt ?? new Date(), unsubscribedAt: null }, include: withArtist });
}

export async function unsubscribe(token: string) {
  const f = await prisma.follower.findUnique({ where: { token }, include: withArtist });
  if (!f) return null;
  if (f.unsubscribedAt) return f;
  return prisma.follower.update({ where: { id: f.id }, data: { unsubscribedAt: new Date() }, include: withArtist });
}

export const artistPageUrl = (slug: string | null) => (slug ? artistUrl(slug, BASE) : BASE);

/** Confirmed, subscribed followers (shown on the artist page once there are 10+). */
export const activeFollowerCount = (artistId: string) => prisma.follower.count({ where: activeWhere(artistId) });
