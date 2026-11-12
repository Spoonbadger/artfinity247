// Collector accounts: an optional, passwordless "collection" for buyers (their orders, follows, wishlist and rewards).
// Server only. Buying never needs one: guest checkout and every signed per-order link keep working without it.
//
// Sign-in is a magic link: a JWT (15 minutes) emailed to the address. Opening it proves the buyer owns that email, and
// sets the httpOnly `collector-token` cookie (a JWT, 90 days). Both are signed with keys derived from JWT_SECRET plus a
// purpose string, so neither can be swapped for the other, or for an artist's `auth-token` (lib/auth.ts, untouched).
//
// Single use without a token table: the link carries the time it was issued (`n`, ms) and consuming it moves
// Collector.lastSeenAt to now, atomically, only if lastSeenAt is still older than `n`. A second click finds lastSeenAt
// newer and is refused; so is any older link once a newer one (or a later paid order) has been seen.
//
// Orders are matched by email (Order.email), so a collector sees every past guest order placed with the address they proved.
import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailEnabled, resend } from "@/lib/resend";
import { SITE_URL } from "@/lib/urls";

export const COLLECTOR_COOKIE = "collector-token";
export const SESSION_DAYS = 90;
export const LINK_MINUTES = 15;
const FROM = "Artfinity <notifications@theartfinity.com>";
const BASE = (process.env.NEXT_PUBLIC_APP_URL || SITE_URL).replace(/\/$/, "");

export const collectorEmailSchema = z.string().trim().toLowerCase().email().max(200);

export type CollectorSession = { id: string; email: string; name: string | null; createdAt: Date };

// ---------- Keys ----------

function derivedKey(purpose: string): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return new Uint8Array(crypto.createHmac("sha256", secret).update(`artfinity:${purpose}:v1`).digest());
}
const linkKey = () => derivedKey("collector-magic-link");
const sessionKey = () => derivedKey("collector-session");

/** Only same-site paths ("/collector", "/@maya/art/x"), never "//evil.com" or a full URL. */
export function safeNext(raw: unknown, fallback = "/collector"): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.length > 300 || /[\r\n]/.test(s)) return fallback;
  return s;
}

// ---------- Magic link ----------

type LinkClaims = { email: string; n: number; save?: string; next?: string };

export async function signLink(email: string, opts: { save?: string | null; next?: string | null } = {}): Promise<string> {
  const claims: Record<string, unknown> = { email, n: Date.now() };
  if (opts.save) claims.save = opts.save;
  if (opts.next) claims.next = safeNext(opts.next);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("collector-link")
    .setIssuedAt()
    .setExpirationTime(`${LINK_MINUTES}m`)
    .sign(linkKey());
}

export const linkUrl = (token: string) => `${BASE}/collector/verify?t=${encodeURIComponent(token)}`;

export type ConsumeResult =
  | { ok: true; collector: CollectorSession; save: string | null; next: string; created: boolean }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/** Checks the link and uses it up. Creates the Collector on first sign-in. */
export async function consumeLink(token: unknown): Promise<ConsumeResult> {
  if (typeof token !== "string" || token.length > 2000) return { ok: false, reason: "invalid" };
  let claims: LinkClaims;
  try {
    claims = (await jwtVerify(token, linkKey(), { algorithms: ["HS256"], audience: "collector-link" })).payload as unknown as LinkClaims;
  } catch (e) {
    return { ok: false, reason: (e as { code?: string })?.code === "ERR_JWT_EXPIRED" ? "expired" : "invalid" };
  }
  const email = collectorEmailSchema.safeParse(claims.email);
  if (!email.success || typeof claims.n !== "number") return { ok: false, reason: "invalid" };
  const issued = new Date(claims.n);
  const now = new Date();
  const select = { id: true, email: true, name: true, createdAt: true } as const;

  let created = false;
  let collector = await prisma.collector.findUnique({ where: { email: email.data }, select });
  if (!collector) {
    try {
      collector = await prisma.collector.create({ data: { email: email.data, lastSeenAt: now }, select });
      created = true;
    } catch (e) {
      // Two tabs opening the same link at once: the other one created it, so this one is a second use.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, reason: "used" };
      throw e;
    }
  } else {
    const { count } = await prisma.collector.updateMany({
      where: { id: collector.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: issued } }] },
      data: { lastSeenAt: now },
    });
    if (count !== 1) return { ok: false, reason: "used" };
  }
  return { ok: true, collector, save: typeof claims.save === "string" ? claims.save : null, next: safeNext(claims.next), created };
}

/** True when this address has bought something (any retail order) or already has a collection. */
export async function knownBuyer(email: string): Promise<boolean> {
  const [order, collector] = await Promise.all([
    prisma.order.findFirst({ where: { ...ordersWhere(email) }, select: { id: true } }),
    prisma.collector.findUnique({ where: { email }, select: { id: true } }),
  ]);
  return !!order || !!collector;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Emails the sign-in link. With `save`, the email says the piece will be saved once they tap it. */
export async function sendSignInLink(email: string, opts: { save?: { id: string; title: string } | null; next?: string | null } = {}) {
  const token = await signLink(email, { save: opts.save?.id ?? null, next: opts.next ?? null });
  const link = linkUrl(token);
  const heading = opts.save ? `Save “${opts.save.title}” to your collection` : "Your Artfinity collection";
  const lead = opts.save
    ? "Tap the button and it's saved, along with any orders you've placed with this email."
    : "Tap the button to see your orders, the artists you follow and your wishlist.";
  const html =
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#15161b;max-width:520px;margin:0 auto;padding:24px">` +
    `<h1 style="margin:0 0 14px;font-size:26px;line-height:1.15">${esc(heading)}</h1>` +
    `<p style="margin:0 0 20px">${esc(lead)}</p>` +
    `<p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#8b2a4b;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:999px">Open my collection</a></p>` +
    `<p style="margin:0;font-size:13px;color:#5b5d66">The link works once, for ${LINK_MINUTES} minutes. Didn't ask for it? Ignore this email and nothing happens. You never need an account to buy.</p>` +
    `<p style="margin:20px 0 0;font-size:14px">— Artfinity</p>` +
    `</div>`;
  const text = `${heading}\n\n${lead}\n\n${link}\n\nThe link works once, for ${LINK_MINUTES} minutes. Didn't ask for it? Ignore this email.`;
  const { error } = await resend.emails.send({ from: FROM, to: email, subject: opts.save ? "Save it to your Artfinity collection" : "Your Artfinity sign-in link", html, text });
  if (error) throw error;
  // Local dev has no inbox: print the link so the flow can be tested.
  if (!emailEnabled) console.log(`[collector:dev] sign-in link for ${email} -> ${link}`);
}

// ---------- Session cookie ----------

export async function signSession(c: { id: string; email: string }): Promise<string> {
  return new SignJWT({ cid: c.id, email: c.email })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("collector-session")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionKey());
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

async function readSession(token: string | undefined): Promise<CollectorSession | null> {
  if (!token) return null;
  let p: Record<string, unknown>;
  try {
    p = (await jwtVerify(token, sessionKey(), { algorithms: ["HS256"], audience: "collector-session" })).payload as Record<string, unknown>;
  } catch {
    return null;
  }
  if (typeof p.cid !== "string" || typeof p.email !== "string") return null;
  const c = await prisma.collector.findUnique({ where: { id: p.cid }, select: { id: true, email: true, name: true, createdAt: true } });
  // Deleted collection, or (never expected) a mismatched address: signed out.
  return c && c.email === p.email ? c : null;
}

/** The signed-in collector, or null. One lookup per request. */
export const getCollector = cache(async (): Promise<CollectorSession | null> => readSession(cookies().get(COLLECTOR_COOKIE)?.value));

/** For pages: the collector, or a redirect to sign-in that comes back to `next`. */
export async function requireCollector(next = "/collector"): Promise<CollectorSession> {
  const c = await getCollector();
  if (!c) redirect(`/collector/sign-in?next=${encodeURIComponent(safeNext(next))}`);
  return c;
}

// ---------- Orders, follows, wishlist ----------

/** The only orders a collector ever sees: retail orders placed with their verified email. */
export const ordersWhere = (email: string): Prisma.OrderWhereInput => ({ email: { equals: email, mode: "insensitive" }, kind: "retail" });

/** Saves a piece (approved, from an active artist). Returns false when it can't be saved. */
export async function saveToWishlist(collectorId: string, artworkId: string): Promise<boolean> {
  const art = await prisma.artwork.findFirst({
    where: { id: artworkId, status: "APPROVED", artist: { closedAt: null, suspendedAt: null } },
    select: { id: true },
  });
  if (!art) return false;
  await prisma.wishlistItem.upsert({
    where: { collectorId_artworkId: { collectorId, artworkId } },
    create: { collectorId, artworkId },
    update: {},
  });
  return true;
}

/** A new order was paid: the buyer's collection (if they have one) was "seen", and maybe earned a reward. Never throws. */
export async function onOrderPaid(orderId: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { email: true, kind: true, paymentStatus: true } });
    if (!order?.email || order.kind !== "retail" || order.paymentStatus !== "paid") return;
    const email = order.email.trim().toLowerCase();
    const { count } = await prisma.collector.updateMany({ where: { email }, data: { lastSeenAt: new Date() } });
    if (!count) return;
    const { issueRewardIfEarned } = await import("@/lib/collectorRewards");
    await issueRewardIfEarned(email);
  } catch (e) {
    console.error("[collector] onOrderPaid failed", orderId, e);
  }
}
