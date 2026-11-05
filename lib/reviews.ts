// Buyer reviews. Server-only: signs review links (HMAC, same secret as lib/scanSign.ts), runs the published-review
// queries and sends the review emails. Pure helpers and types are in components/reviews/format.ts.
//
// Buyers have no account, so the link in the "how does it look on your wall?" email carries a signature of
// `review:<orderId>`. Anyone holding that link can review that order's items, nothing else.
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { resend, emailEnabled } from "@/lib/resend";
import { emailHtml, firstNameOf } from "@/lib/artistEmails";
import { shortName, type PublicReview, type ReviewSummary } from "@/components/reviews/format";

export { shortName };
export type { PublicReview, ReviewSummary };

const SECRET = process.env.SCAN_SIGNING_SECRET || process.env.JWT_SECRET || "";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com").replace(/\/$/, "");
const FROM = "Artfinity <notifications@theartfinity.com>";
const DAY = 86400000;

/** Buyers can change their review for this long after first posting it. */
export const EDIT_WINDOW_DAYS = 30;
/**
 * Shipped orders open for reviews after this many days even if nobody marked them delivered.
 * Orders store no shipped date, so this counts from the order date (printing takes a few days, so it's ~10 days in transit).
 */
export const SHIPPED_OPEN_DAYS = 14;

// ---------- Signing ----------

export function signReview(orderId: string): string {
  return crypto.createHmac("sha256", SECRET).update(`review:${orderId}`).digest("base64url").slice(0, 22);
}

export function verifyReview(orderId: string, sig: unknown): boolean {
  if (!SECRET || !orderId || typeof sig !== "string" || sig.length !== 22) return false;
  const want = Buffer.from(signReview(orderId));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export const reviewPath = (orderId: string) => `/review/${orderId}?t=${signReview(orderId)}`;
export const reviewUrl = (orderId: string) => `${APP_URL}${reviewPath(orderId)}`;

// ---------- Rules ----------

type OrderGate = { kind: string; paymentStatus: string; shippingStatus: string; createdAt: Date };

/** open: buyer can review. waiting: still in transit. never: bulk or unpaid orders. */
export function reviewState(o: OrderGate, now = Date.now()): "open" | "waiting" | "never" {
  if (o.kind === "bulk" || o.paymentStatus !== "paid") return "never";
  if (o.shippingStatus === "delivered") return "open";
  if (o.shippingStatus === "shipped" && now - o.createdAt.getTime() > SHIPPED_OPEN_DAYS * DAY) return "open";
  return "waiting";
}

export const canEdit = (createdAt: Date, now = Date.now()) => now - createdAt.getTime() < EDIT_WINDOW_DAYS * DAY;

/** "10 Halsey St, Brooklyn, NY 11216, US" -> "Brooklyn". Empty when it can't tell (never returns the street). */
export function cityFromAddress(address: string | null | undefined) {
  let p = String(address || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (p.length >= 3 && !/\d/.test(p[p.length - 1]) && /\d/.test(p[p.length - 2])) p = p.slice(0, -1);
  if (p.length < 3) return "";
  const city = p[p.length - 2];
  return /\d/.test(city) || city.length > 40 ? "" : city;
}

// A short list on purpose: this only holds a review for a person to look at, it never rejects one.
const ROUGH = ["fuck", "shit", "bitch", "cunt", "asshole", "bastard", "dick", "piss", "slut", "whore", "fag", "retard", "nigger", "scam"];
const ROUGH_RE = new RegExp(`\\b(${ROUGH.join("|")})\\w*`, "i");
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|shop|store|xyz|ly|me|biz|info)\b)/i;

/** "flagged" holds a review for admin; everything else publishes right away. */
export function moderate(text: string): "published" | "flagged" {
  return LINK_RE.test(text) || ROUGH_RE.test(text) ? "flagged" : "published";
}

// ---------- Public queries ----------

const PUBLISHED = { status: "published" } as const;

const publicSelect = {
  id: true, rating: true, body: true, buyerName: true, buyerCity: true, photoUrl: true, createdAt: true,
  artistReply: true, artistReplyAt: true,
  artwork: { select: { title: true, slug: true, imageUrl: true, artist: { select: { slug: true } } } },
} as const;

type Scope = { artistId: string } | { artworkId: string };

function toPublic(r: any): PublicReview {
  return {
    id: r.id, rating: r.rating, body: r.body, buyerName: r.buyerName, buyerCity: r.buyerCity, photoUrl: r.photoUrl,
    createdAt: r.createdAt.toISOString(),
    artistReply: r.artistReply, artistReplyAt: r.artistReplyAt ? r.artistReplyAt.toISOString() : null,
    artwork: r.artwork,
  };
}

/** Average rating (one decimal) and count of published reviews for an artist or an artwork. */
export async function getReviewSummary(scope: Scope): Promise<ReviewSummary> {
  const agg = await prisma.review.aggregate({ where: { ...scope, ...PUBLISHED }, _avg: { rating: true }, _count: { _all: true } });
  const count = agg._count._all;
  return { average: count ? Math.round((agg._avg.rating ?? 0) * 10) / 10 : 0, count };
}

/** Published reviews, newest first. */
export async function getPublishedReviews(scope: Scope, take = 24): Promise<PublicReview[]> {
  const rows = await prisma.review.findMany({ where: { ...scope, ...PUBLISHED }, orderBy: { createdAt: "desc" }, take, select: publicSelect });
  return rows.map(toPublic);
}

/** Summary + list in one call, for a page that shows both. */
export async function getReviews(scope: Scope, take = 24) {
  const [summary, reviews] = await Promise.all([getReviewSummary(scope), getPublishedReviews(scope, take)]);
  return { summary, reviews };
}

// ---------- Emails ----------

const btn = (href: string, label: string) =>
  `<p style="margin:8px 0 24px"><a href="${href}" style="display:inline-block;background:#2b37f0;color:#fff;font-weight:700;text-decoration:none;padding:13px 22px;border-radius:999px">${label}</a></p>`;

/** Inserts an HTML button before the footer of an emailHtml() body. */
const withButton = (html: string, href: string, label: string) => html.replace(/<p style="margin:24px 0 0;/, `${btn(href, label)}<p style="margin:24px 0 0;`);

/**
 * Asks the buyer for a review once their order is delivered. Retail, paid orders only, and only if something is left to review.
 * Safe to call more than once per order (it just sends again), so callers should only call it on the delivered transition.
 */
export async function sendReviewRequest(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, email: true, shippingName: true, kind: true, paymentStatus: true, shippingStatus: true, createdAt: true,
      items: { select: { title: true, artistName: true, review: { select: { id: true } } } },
    },
  });
  if (!order?.email || reviewState(order) !== "open") return false;
  const todo = order.items.filter((i) => !i.review);
  if (!todo.length) return false;

  const url = reviewUrl(order.id);
  const one = todo.length === 1 ? todo[0] : null;
  const what = one ? `${one.title || "your print"}${one.artistName ? ` by ${one.artistName}` : ""}` : "your prints";
  const text =
    `Hi ${firstNameOf(order.shippingName)},\n\n` +
    `${what[0].toUpperCase() + what.slice(1)} should be with you now. How does it look on your wall?\n\n` +
    `A few words or a quick photo helps the artist more than you'd think. It takes a minute.\n\n` +
    `${url}`;
  const html = withButton(emailHtml(text.replace(`\n\n${url}`, "")), url, "Leave a review");
  await resend.emails.send({ from: FROM, to: order.email, subject: "How does it look on your wall?", html, text });
  if (!emailEnabled) console.log(`[review-link] order=${order.id} ${url}`);
  return true;
}

/** Tells the artist a new review is up. Only for published reviews; flagged ones wait for admin. */
export async function notifyArtistOfReview(reviewId: string) {
  const r = await prisma.review.findUnique({
    where: { id: reviewId },
    select: {
      rating: true, body: true, buyerName: true, buyerCity: true, status: true,
      artist: { select: { email: true, first_name: true, artist_name: true, name: true, closedAt: true } },
      artwork: { select: { title: true } },
    },
  });
  if (!r || r.status !== "published" || !r.artist.email || r.artist.closedAt) return false;
  const who = [r.buyerName, r.buyerCity].filter(Boolean).join(" from ");
  const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
  const text =
    `Hi ${r.artist.first_name || firstNameOf(r.artist.artist_name || r.artist.name)},\n\n` +
    `${who} left a review${r.artwork ? ` on ${r.artwork.title}` : ""}: ${stars}\n\n` +
    (r.body ? `"${r.body}"\n\n` : "") +
    `You can reply once from your Studio. Buyers see it under their review.`;
  const url = `${APP_URL}/studio/reviews`;
  await resend.emails.send({
    from: FROM,
    to: r.artist.email,
    subject: `New ${r.rating}-star review${r.artwork ? ` on ${r.artwork.title}` : ""}`,
    html: withButton(emailHtml(text), url, "See it in your Studio"),
    text: `${text}\n\n${url}`,
  });
  return true;
}
