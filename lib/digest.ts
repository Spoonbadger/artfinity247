// The artist weekly digest (Mondays 9am New York, app/api/cron/artist-digest). Server only.
//
// Each artist gets one email about the last 7 days: scans, page views, prints sold and what they earned, their best
// painting, new reviews and followers, and one tip (a fix first: unfinished Stripe setup or no way to get paid; else a
// nudge: pieces without room scenes, no printed code yet, no followers). Artists with no activity and nothing to fix
// get nothing. One-click opt-out (signed link, stored with lib/artistPrefs, no schema change). Sent at most once per
// week per artist, so a re-run (or "Run now") doesn't send twice.
import { prisma } from "@/lib/prisma";
import { emailEnabled, resend } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { getArtistAnalytics } from "@/lib/analytics";
import { itemBreakdown } from "@/lib/sales";
import { activeRefunds, shareAfterRefund } from "@/lib/refunds";
import { connectStatus } from "@/lib/stripeConnect";
import { getPrefs, setPref, signPrefLink } from "@/lib/artistPrefs";
import { money } from "@/lib/earnings";

const FROM = "Artfinity <notifications@theartfinity.com>";
const BASE = () => (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const TZ = "America/New_York";
const DAY = 86_400_000;

type DigestPref = { off?: boolean; lastWeek?: string };

/** "2026-11-02": the New York date of this week's Monday. */
export function weekKey(now: Date) {
  const [y, m, d] = now.toLocaleDateString("en-CA", { timeZone: TZ }).split("-").map(Number);
  const local = new Date(Date.UTC(y, m - 1, d));
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.toISOString().slice(0, 10);
}

/** True at 9:xx on a Monday in New York (the cron runs at 13:00 and 14:00 UTC so one of them is 9am, DST or not). */
// Monday morning in New York. The cron runs once, at 13:00 UTC (8am EST, 9am EDT), and Vercel's Hobby plan may fire it
// any time in that hour, so 8 and 9 both count. The weekly "already sent" check stops a second send.
export function isDigestHour(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value);
  return parts.find((p) => p.type === "weekday")?.value === "Mon" && (hour === 8 || hour === 9);
}

export const digestOptOutUrl = (artistId: string) => `${BASE()}/api/digest/unsubscribe?a=${artistId}&t=${signPrefLink(artistId, "digest")}`;

export type Tip = { text: string; fix: boolean; link: string };

export type ArtistDigest = {
  artistId: string;
  email: string;
  firstName: string;
  scans: number;
  views: number;
  prints: number;
  earnedCents: number;
  best: { title: string; url: string; why: string } | null;
  reviews: { count: number; average: number };
  followers: number;
  tip: Tip | null;
  active: boolean;
};

type ArtistRow = {
  id: string; email: string; slug: string; first_name: string | null; artist_name: string | null; name: string;
  stripeAccountId: string | null; stripePayoutsEnabled: boolean;
};

export async function buildDigest(a: ArtistRow, now: Date): Promise<ArtistDigest> {
  const from = new Date(now.getTime() - 7 * DAY);
  const base = BASE();
  const [stats, items, reviews, followers, noScenes, codes, followerTotal] = await Promise.all([
    getArtistAnalytics(a.id, 7, now),
    prisma.orderItem.findMany({
      where: { artwork: { artistId: a.id }, order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: from, lt: now } } },
      select: { id: true, orderId: true, artworkId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, order: { select: { createdAt: true } } },
    }),
    prisma.review.aggregate({ where: { artistId: a.id, status: "published", createdAt: { gte: from, lt: now } }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.follower.count({ where: { artistId: a.id, confirmedAt: { gte: from, lt: now }, unsubscribedAt: null } }),
    prisma.artwork.count({ where: { artistId: a.id, status: "APPROVED", roomScenes: { isEmpty: true } } }),
    prisma.qrCode.count({ where: { artistId: a.id } }),
    prisma.follower.count({ where: { artistId: a.id, confirmedAt: { not: null }, unsubscribedAt: null } }),
  ]);

  const refunds = await activeRefunds(Array.from(new Set(items.map((i) => i.orderId))));
  let prints = 0;
  let earnedCents = 0;
  const soldBy = new Map<string, number>();
  for (const i of items) {
    const r = refunds.get(i.id);
    if (r) continue;
    const b = itemBreakdown({ ...i, orderDate: i.order.createdAt });
    prints += b.quantity;
    earnedCents += shareAfterRefund(b.artistShare, r);
    if (i.artworkId) soldBy.set(i.artworkId, (soldBy.get(i.artworkId) ?? 0) + b.quantity);
  }

  // Best painting: most prints sold this week, else most views.
  let best: ArtistDigest["best"] = null;
  const topSold = Array.from(soldBy).sort((x, y) => y[1] - x[1])[0];
  const topViewed = stats.artworks.filter((w) => w.views > 0).sort((x, y) => y.views - x.views)[0];
  const pick = topSold ? stats.artworks.find((w) => w.id === topSold[0]) ?? null : topViewed ?? null;
  if (topSold && !pick) {
    const w = await prisma.artwork.findUnique({ where: { id: topSold[0] }, select: { title: true, slug: true } });
    if (w) best = { title: w.title, url: w.slug ? `${base}/@${a.slug}/art/${w.slug}` : `${base}/@${a.slug}`, why: `${topSold[1]} ${topSold[1] === 1 ? "print" : "prints"} sold` };
  } else if (pick) {
    best = {
      title: pick.title,
      url: pick.slug ? `${base}/@${a.slug}/art/${pick.slug}` : `${base}/@${a.slug}`,
      why: topSold ? `${topSold[1]} ${topSold[1] === 1 ? "print" : "prints"} sold, ${pick.views} views` : `${pick.views} views`,
    };
  }

  // One tip. Fixes first (they cost the artist money), then nudges.
  const status = connectStatus(a);
  let tip: Tip | null = null;
  // Payouts are Stripe-only: until it's set up, earnings wait in their balance.
  if (status === "pending") tip = { fix: true, text: "Your Stripe setup isn't finished. Finish it so we can pay you.", link: `${base}/studio/money` };
  else if (status === "not_connected") tip = { fix: true, text: "Connect Stripe so we can pay you. Your earnings wait until you do.", link: `${base}/studio/money` };
  else if (noScenes > 0) tip = { fix: false, text: `${noScenes} ${noScenes === 1 ? "painting has" : "paintings have"} no room scenes picked. Buyers who see a piece on a wall buy more often.`, link: `${base}/studio/rooms` };
  else if (codes === 0) tip = { fix: false, text: "You haven't printed a QR code yet. Put one next to your work at your next show or café wall.", link: `${base}/studio/qr` };
  else if (followerTotal === 0) tip = { fix: false, text: "Nobody follows you yet. Add your Artfinity link to your Instagram bio so fans can follow.", link: `${base}/studio/followers` };

  const reviewCount = reviews._count._all;
  const active = stats.scans + stats.views + prints + reviewCount + followers > 0;
  return {
    artistId: a.id,
    email: a.email,
    firstName: a.first_name || firstNameOf(a.artist_name || a.name),
    scans: stats.scans,
    views: stats.views,
    prints,
    earnedCents,
    best,
    reviews: { count: reviewCount, average: reviewCount ? Math.round((reviews._avg.rating ?? 0) * 10) / 10 : 0 },
    followers,
    tip,
    active,
  };
}

export function digestText(d: ArtistDigest, now: Date) {
  const from = new Date(now.getTime() - 7 * DAY);
  const fmt = (x: Date) => x.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
  const lines = [
    `Hi ${d.firstName},`,
    `Your week on Artfinity (${fmt(from)} – ${fmt(new Date(now.getTime() - 1))}):`,
    [
      `• ${d.scans} QR ${d.scans === 1 ? "scan" : "scans"}`,
      `• ${d.views} page ${d.views === 1 ? "view" : "views"}`,
      `• ${d.prints} ${d.prints === 1 ? "print" : "prints"} sold${d.prints ? `, ${money(d.earnedCents)} earned` : ""}`,
      d.reviews.count ? `• ${d.reviews.count} new ${d.reviews.count === 1 ? "review" : "reviews"} (${d.reviews.average}★ average)` : "• No new reviews",
      `• ${d.followers} new ${d.followers === 1 ? "follower" : "followers"}`,
    ].join("\n"),
  ];
  if (d.best) lines.push(`Your best painting this week: ${d.best.title} (${d.best.why})\n${d.best.url}`);
  if (d.tip) lines.push(`${d.tip.fix ? "To fix" : "One tip"}: ${d.tip.text}\n${d.tip.link}`);
  lines.push(`See everything in your Studio: ${BASE()}/studio/analytics`);
  lines.push(`Don't want this weekly email? Turn it off with one click: ${digestOptOutUrl(d.artistId)}`);
  return lines.join("\n\n");
}

export type DigestRun = { week: string; sent: string[]; skippedInactive: number; skippedOptOut: number; alreadySent: number; failed: { email: string; error: string }[] };

/** Sends this week's digest to every artist who should get one. `only` limits it to some artist ids (tests). */
export async function sendWeeklyDigests(now = new Date(), only?: string[]): Promise<DigestRun> {
  const week = weekKey(now);
  const artists = await prisma.artist.findMany({
    // Artists with at least one piece (an account that never uploaded gets nothing).
    where: { role: "USER", closedAt: null, suspendedAt: null, artworks: { some: {} }, ...(only ? { id: { in: only } } : {}) },
    select: { id: true, email: true, slug: true, first_name: true, artist_name: true, name: true, stripeAccountId: true, stripePayoutsEnabled: true },
  });
  const prefs = await getPrefs<DigestPref>(artists.map((a) => a.id), "digest");
  const out: DigestRun = { week, sent: [], skippedInactive: 0, skippedOptOut: 0, alreadySent: 0, failed: [] };
  for (const a of artists) {
    const p = prefs.get(a.id) ?? {};
    if (p.off) { out.skippedOptOut++; continue; }
    if (p.lastWeek === week) { out.alreadySent++; continue; }
    try {
      const d = await buildDigest(a, now);
      if (!d.active && !d.tip?.fix) { out.skippedInactive++; continue; }
      const text = digestText(d, now);
      const { error } = await resend.emails.send({
        from: FROM,
        to: a.email,
        subject: d.prints ? `Your week: ${d.prints} ${d.prints === 1 ? "print" : "prints"} sold, ${money(d.earnedCents)} earned` : d.active ? `Your week on Artfinity: ${d.views} views, ${d.scans} scans` : "One thing to fix on Artfinity",
        text,
        html: emailHtml(text, "Your weekly Artfinity digest. From paint to print."),
        headers: { "List-Unsubscribe": `<${digestOptOutUrl(a.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      if (error) throw error;
      if (!emailEnabled) console.log(`[email:dev] weekly digest for ${a.email}\n${text}\n[/email:dev]`);
      await setPref<DigestPref>(a.id, "digest", { lastWeek: week });
      out.sent.push(a.email);
    } catch (err) {
      console.error("[digest] failed", a.email, err);
      out.failed.push({ email: a.email, error: ((err as Error)?.message || "send failed").slice(0, 200) });
    }
  }
  return out;
}
