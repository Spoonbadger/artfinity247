// lib/referrals.ts (server only)
// "Share Artfinity, get 2 months of Infinity."
//
// A referral pays REFERRALS.rewardMonths of Infinity once the artist who signed up with ?ref=CODE:
//   1. has a live (approved) piece, AND
//   2. has printed a code (a QrCode row exists; codes are made when the artist prints or downloads one) or made a
//      paid retail sale, AND
//   3. isn't the referrer on a second account: the same browser (first-party device cookie), or the same
//      private email domain plus the same network (hashed sign-up/login IP), gets no reward ("blocked").
// Email verification would be a 4th rule, but Artfinity has no email verification yet, so it's skipped.
// The reward is held REFERRALS.holdDays days after the artist qualifies (the later of their first live piece and
// their first code or sale), then unlocks if they still qualify. At most REFERRALS.maxPerMonth rewards unlock per
// calendar month (UTC), and only while the months fit under REFERRALS.maxBankedMonths ahead of today; otherwise
// the reward waits for next month or for room. Nothing is lost by waiting.
//
// State without schema fields: one Message row per referral on the referrer, direction "referral" and email
// "ref:<referredArtistId>" (not an email, so the customer CRM never shows it):
//   subject "Referral hold"     sentAt null   body {"qualifiedAt","unlockAt"}   waiting to unlock
//   subject "Referral reward"   sentAt = when the months were added                 rewarded (older rows too)
//   subject "Referral blocked"  body {"reason"}                                     never pays
// It survives the referred artist deleting and re-uploading art, so one referral pays out once.
// Sign-up and login signals are one Message row on each artist (direction "device"), hashed with the server
// secret: never a raw IP.
//
// Settling (creating holds, unlocking due ones) runs when a referred artist's piece goes live, when the referrer
// opens /studio/infinity, and at most every few minutes from any Studio page (getArtistPlan).
import { createHmac, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { REFERRALS, addDays, addMonths, isProActive } from "@/lib/plans";

export const REFERRAL_DIRECTION = "referral";
const ledgerEmail = (referredId: string) => `ref:${referredId}`;
const HOLD = "Referral hold";
const REWARD = "Referral reward";
const BLOCKED = "Referral blocked";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I

export function normalizeReferralCode(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  return s.length >= 4 && s.length <= 24 ? s : null;
}

function makeCode(slug: string) {
  const head = slug.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "ART";
  const bytes = randomBytes(4);
  const tail = Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${head}-${tail}`;
}

/** The artist's referral code, created on first use. */
export async function ensureReferralCode(artistId: string): Promise<string> {
  const a = await prisma.artist.findUnique({ where: { id: artistId }, select: { slug: true, referralCode: true } });
  if (!a) throw new Error("Artist not found");
  if (a.referralCode) return a.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = makeCode(a.slug);
    try {
      // Only set it if still empty (two tabs opening the page at once get the same code).
      const res = await prisma.artist.updateMany({ where: { id: artistId, referralCode: null }, data: { referralCode: code } });
      if (res.count === 1) return code;
      const again = await prisma.artist.findUnique({ where: { id: artistId }, select: { referralCode: true } });
      if (again?.referralCode) return again.referralCode;
    } catch {
      // unique collision: try another code
    }
  }
  throw new Error("Could not create a referral code");
}

export function referralLink(code: string, base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com") {
  return `${base.replace(/\/$/, "")}/register?ref=${encodeURIComponent(code)}`;
}

/** Referrer's id for a code typed or linked at sign-up, or null. */
export async function referrerForCode(raw: unknown): Promise<string | null> {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  const a = await prisma.artist.findUnique({ where: { referralCode: code }, select: { id: true } });
  return a?.id ?? null;
}

// ---------- Device signals (sign-up / login) ----------

export const DEVICE_COOKIE = "af_dev";
const SIGNAL_DIRECTION = "device";
const SIGNAL_EMAIL = "device:signals";
const SECRET = process.env.JWT_SECRET || "artfinity-dev";

type Signal = { ip: string | null; dev: string | null; at: string };
type Signals = { signup?: Signal; seen: Signal[] };

const fp = (kind: string, value: string) => createHmac("sha256", SECRET).update(`${kind}|${value}`).digest("base64url").slice(0, 16);

function cookieFrom(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function parseSignals(body: string | null | undefined): Signals {
  try {
    const j = JSON.parse(body || "");
    return { signup: j.signup, seen: Array.isArray(j.seen) ? j.seen : [] };
  } catch {
    return { seen: [] };
  }
}

/**
 * Keeps hashed network and browser signals for an artist (at sign-up and each login), for the referral
 * same-person check. Returns the device id to set as DEVICE_COOKIE (a random id per browser). Never throws.
 */
export async function recordDeviceSignal(artistId: string, req: Request, kind: "signup" | "login"): Promise<string> {
  const existing = cookieFrom(req, DEVICE_COOKIE);
  const device = existing && /^[\w-]{16,64}$/.test(existing) ? existing : randomBytes(16).toString("base64url");
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    const sig: Signal = { ip: ip ? fp("ip", ip) : null, dev: fp("dev", device), at: new Date().toISOString() };
    const row = await prisma.message.findFirst({ where: { artistId, direction: SIGNAL_DIRECTION, email: SIGNAL_EMAIL }, select: { id: true, body: true } });
    const data = parseSignals(row?.body);
    if (kind === "signup") data.signup = sig;
    data.seen = [sig, ...data.seen.filter((s) => s.ip !== sig.ip || s.dev !== sig.dev)].slice(0, 8);
    const body = JSON.stringify(data);
    if (row) await prisma.message.update({ where: { id: row.id }, data: { body } });
    else await prisma.message.create({ data: { artistId, email: SIGNAL_EMAIL, direction: SIGNAL_DIRECTION, subject: "Device signals", body } });
  } catch (err) {
    console.error("Device signal not recorded", err);
  }
  return device;
}

export const deviceCookie = (value: string) => ({
  name: DEVICE_COOKIE,
  value,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 730,
});

const domainOf = (email: string | null | undefined) => String(email || "").trim().toLowerCase().split("@")[1] || "";

// Big free mail providers: sharing one says nothing about being the same person.
const PUBLIC_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
  "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "zoho.com", "fastmail.com",
]);

/**
 * Same browser (device cookie) = same person. A shared network only counts together with the same
 * private email domain (e.g. both @mystudio.com), so friends on Gmail and the same Wi-Fi still earn rewards.
 * Unknown signals never block.
 */
function samePerson(a: { email: string; signals: Signals }, b: { email: string; signals: Signals }) {
  const list = (s: Signals) => [s.signup, ...s.seen].filter((x): x is Signal => !!x);
  const aDevs = new Set(list(a.signals).map((s) => s.dev).filter(Boolean));
  if (list(b.signals).some((s) => s.dev && aDevs.has(s.dev))) return true;
  const domain = domainOf(a.email);
  if (!domain || PUBLIC_MAIL.has(domain) || domain !== domainOf(b.email)) return false;
  const aIps = new Set(list(a.signals).map((s) => s.ip).filter(Boolean));
  return list(b.signals).some((s) => s.ip && aIps.has(s.ip));
}

// ---------- Qualifying and settling ----------

type Facts = { liveAt: Date | null; actionAt: Date | null; qualifiedAt: Date | null };

async function referredFacts(ids: string[]): Promise<Map<string, Facts & { email: string }>> {
  if (!ids.length) return new Map();
  const [artists, sales] = await Promise.all([
    prisma.artist.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, email: true,
        artworks: { where: { status: "APPROVED" }, orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
        qrCodes: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
      },
    }),
    prisma.$queryRaw<{ artistId: string; first: Date }[]>`
      SELECT a."artistId" AS "artistId", MIN(o."createdAt") AS first
      FROM "OrderItem" oi
      JOIN "Artwork" a ON a.id = oi."artworkId"
      JOIN "Order" o ON o.id = oi."orderId"
      WHERE o."paymentStatus" = 'paid' AND o.kind = 'retail' AND a."artistId" = ANY(${ids}::text[])
      GROUP BY a."artistId"`,
  ]);
  const firstSale = new Map(sales.map((s) => [s.artistId, new Date(s.first)]));
  const out = new Map<string, Facts & { email: string }>();
  for (const a of artists) {
    const liveAt = a.artworks[0]?.createdAt ?? null;
    const code = a.qrCodes[0]?.createdAt ?? null;
    const sale = firstSale.get(a.id) ?? null;
    const actionAt = code && sale ? (code < sale ? code : sale) : code || sale;
    const qualifiedAt = liveAt && actionAt ? (liveAt > actionAt ? liveAt : actionAt) : null;
    out.set(a.id, { email: a.email, liveAt, actionAt, qualifiedAt });
  }
  return out;
}

type LedgerRow = { id: string; email: string; subject: string | null; body: string; sentAt: Date | null; createdAt: Date };

function holdInfo(row: LedgerRow): { unlockAt: Date; qualifiedAt: Date } | null {
  try {
    const j = JSON.parse(row.body);
    return { unlockAt: new Date(j.unlockAt), qualifiedAt: new Date(j.qualifiedAt) };
  } catch {
    return null;
  }
}

const isRewarded = (r: LedgerRow) => !!r.sentAt && r.subject !== HOLD && r.subject !== BLOCKED;
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const nextMonthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));

/**
 * Brings one referrer's referrals up to date: new qualifiers get a hold (or a block), holds that are due unlock
 * within the monthly and banked caps. Safe to call often and concurrently.
 */
export async function settleReferrals(referrerId: string, now = new Date()): Promise<{ granted: number }> {
  const referred = await prisma.artist.findMany({ where: { referredById: referrerId, NOT: { id: referrerId } }, select: { id: true } });
  if (!referred.length) return { granted: 0 };
  const facts = await referredFacts(referred.map((r) => r.id));
  const signalRows = await prisma.message.findMany({
    where: { artistId: { in: [referrerId, ...referred.map((r) => r.id)] }, direction: SIGNAL_DIRECTION, email: SIGNAL_EMAIL },
    select: { artistId: true, body: true },
  });
  const signals = new Map(signalRows.map((r) => [r.artistId, parseSignals(r.body)]));

  return prisma.$transaction(async (tx) => {
    // Lock the referrer row so two settles at once can't both create or grant.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Artist" WHERE id = ${referrerId} FOR UPDATE`;
    if (!locked.length) return { granted: 0 };
    const referrer = await tx.artist.findUnique({ where: { id: referrerId }, select: { email: true, proUntil: true } });
    const ledger: LedgerRow[] = await tx.message.findMany({
      where: { artistId: referrerId, direction: REFERRAL_DIRECTION },
      select: { id: true, email: true, subject: true, body: true, sentAt: true, createdAt: true },
    });
    const byReferred = new Map(ledger.map((r) => [r.email.replace(/^ref:/, ""), r]));

    // 1. New qualifiers: hold, or block when it looks like the referrer on a second account.
    for (const [id, f] of Array.from(facts)) {
      if (byReferred.has(id) || !f.qualifiedAt) continue;
      const blocked = samePerson({ email: referrer!.email, signals: signals.get(referrerId) ?? { seen: [] } }, { email: f.email, signals: signals.get(id) ?? { seen: [] } });
      const unlockAt = addDays(f.qualifiedAt, REFERRALS.holdDays);
      const row = await tx.message.create({
        data: {
          artistId: referrerId,
          email: ledgerEmail(id),
          direction: REFERRAL_DIRECTION,
          subject: blocked ? BLOCKED : HOLD,
          body: JSON.stringify(blocked ? { reason: "same_person", at: now.toISOString() } : { qualifiedAt: f.qualifiedAt.toISOString(), unlockAt: unlockAt.toISOString() }),
        },
        select: { id: true, email: true, subject: true, body: true, sentAt: true, createdAt: true },
      });
      byReferred.set(id, row);
      ledger.push(row);
      console.info(blocked ? "REFERRAL_BLOCKED" : "REFERRAL_HELD", JSON.stringify({ referrerId, referredId: id, unlockAt: blocked ? null : unlockAt.toISOString() }));
    }

    // 2. Due holds unlock, oldest first, while the referred artist still qualifies and the caps allow.
    let thisMonth = ledger.filter((r) => isRewarded(r) && r.sentAt! >= monthStart(now)).length;
    let proUntil = referrer!.proUntil;
    let granted = 0;
    const due = ledger
      .filter((r) => r.subject === HOLD && !r.sentAt)
      .map((r) => ({ r, info: holdInfo(r) }))
      .filter((x) => x.info && x.info.unlockAt <= now)
      .sort((a, b) => a.info!.unlockAt.getTime() - b.info!.unlockAt.getTime());
    for (const { r } of due) {
      const id = r.email.replace(/^ref:/, "");
      if (!facts.get(id)?.qualifiedAt) continue; // piece taken down or code gone: waits until they qualify again
      if (thisMonth >= REFERRALS.maxPerMonth) break;
      const from = isProActive({ proUntil }, now) ? proUntil! : now;
      const next = addMonths(from, REFERRALS.rewardMonths);
      if (next > addMonths(now, REFERRALS.maxBankedMonths)) break; // no room under the banked cap yet
      proUntil = next;
      await tx.artist.update({ where: { id: referrerId }, data: { proUntil } });
      await tx.message.update({
        where: { id: r.id },
        data: { subject: REWARD, sentAt: now, body: `+${REFERRALS.rewardMonths} months of Infinity. Infinity until ${proUntil.toISOString()}.` },
      });
      thisMonth++;
      granted++;
      console.info("REFERRAL_REWARD", JSON.stringify({ referrerId, referredId: id, proUntil: proUntil.toISOString() }));
    }
    return { granted };
  });
}

/** After a referred artist's piece goes live: settle their referrer. Safe to call more than once. */
export async function rewardReferralOnUpload(artistId: string) {
  const me = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, referredById: true } });
  if (!me?.referredById || me.referredById === me.id) return { granted: 0 };
  return settleReferrals(me.referredById);
}

const lastSettle = new Map<string, number>();
/** Cheap, throttled settle for Studio page loads (at most every 5 minutes per artist per server). */
export async function settleReferralsSoon(artistId: string) {
  const t = lastSettle.get(artistId) ?? 0;
  if (Date.now() - t < 5 * 60_000) return;
  lastSettle.set(artistId, Date.now());
  try {
    await settleReferrals(artistId);
  } catch (err) {
    console.error("Referral settle failed", err);
  }
}

// ---------- What the referrer sees ----------

/**
 * joined: no live piece yet. live: piece live, no code printed or sale yet. held: waiting out the hold (unlockAt).
 * capped: hold is over, waiting for next month's allowance (unlockAt = 1st of next month) or for banked room.
 * blocked: looks like the referrer's own second account. rewarded: months added.
 */
export type ReferralStatus = "joined" | "live" | "held" | "capped" | "blocked" | "rewarded";

/** Everyone this artist referred, newest first, with an honest status. Settles first. */
export async function getReferrals(artistId: string) {
  await settleReferrals(artistId).catch((err) => console.error("Referral settle failed", err));
  const now = new Date();
  const [rows, ledger, me] = await Promise.all([
    prisma.artist.findMany({
      where: { referredById: artistId, NOT: { id: artistId } },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, artist_name: true, name: true, first_name: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: { artistId, direction: REFERRAL_DIRECTION },
      select: { id: true, email: true, subject: true, body: true, sentAt: true, createdAt: true },
    }),
    prisma.artist.findUnique({ where: { id: artistId }, select: { proUntil: true } }),
  ]);
  const facts = await referredFacts(rows.map((r) => r.id));
  const byReferred = new Map(ledger.map((m) => [m.email.replace(/^ref:/, ""), m]));
  const thisMonth = ledger.filter((r) => isRewarded(r) && r.sentAt! >= monthStart(now)).length;
  const from = isProActive(me, now) ? me!.proUntil! : now;
  const roomForMore = addMonths(from, REFERRALS.rewardMonths) <= addMonths(now, REFERRALS.maxBankedMonths);

  return rows.map((r) => {
    const row = byReferred.get(r.id);
    const f = facts.get(r.id);
    let status: ReferralStatus;
    let unlockAt: Date | null = null;
    let capReason: "month" | "banked" | null = null;
    if (row && isRewarded(row)) status = "rewarded";
    else if (row?.subject === BLOCKED) status = "blocked";
    else if (!f?.liveAt) status = "joined";
    else if (!f.qualifiedAt) status = "live";
    else {
      unlockAt = (row && holdInfo(row)?.unlockAt) || addDays(f.qualifiedAt, REFERRALS.holdDays);
      if (unlockAt > now) status = "held";
      else {
        status = "capped";
        if (thisMonth >= REFERRALS.maxPerMonth) { capReason = "month"; unlockAt = nextMonthStart(now); }
        else if (!roomForMore) { capReason = "banked"; unlockAt = null; }
        else unlockAt = now; // unlocks on the next settle
      }
    }
    return {
      id: r.id,
      handle: r.slug,
      name: r.artist_name || r.name,
      firstName: (r.first_name || r.artist_name || r.name || r.slug).split(/\s+/)[0],
      joined: r.createdAt,
      status,
      unlockAt,
      capReason,
      rewardedAt: row && isRewarded(row) ? row.sentAt : null,
    };
  });
}

export type ReferralRow = Awaited<ReturnType<typeof getReferrals>>[number];
