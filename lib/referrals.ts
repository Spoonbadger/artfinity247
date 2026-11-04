// lib/referrals.ts (server only)
// "Share Artfinity, get 2 months of Infinity."
//
// Rule: an artist who signs up with ?ref=CODE and makes their first approved upload earns the
// referrer REFERRALS.rewardMonths of Infinity, extended from max(now, proUntil) and capped at
// REFERRALS.maxBankedMonths ahead of today.
//
// Planned anti-abuse (not enforced yet): also require a real sale or verification within
// REFERRALS.verifyWithinDays days before the reward is granted.
//
// Idempotency: there is no schema field for "reward granted" yet (proposed: Artist.referralRewardedAt
// DateTime? on the referred artist). Until then each grant is recorded as a Message row on the
// referrer with direction "referral" and email "ref:<referredArtistId>". That address is not an
// email, so the customer CRM (which looks messages up by buyer email) never shows it. It survives
// the referred artist deleting and re-uploading art, so one referral pays out once.
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { REFERRALS, addMonths, isProActive } from "@/lib/plans";

export const REFERRAL_DIRECTION = "referral";
const ledgerEmail = (referredId: string) => `ref:${referredId}`;

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

export type RewardResult =
  | { granted: true; referrerId: string; proUntil: Date; capped: boolean }
  | { granted: false; reason: "not_referred" | "not_approved" | "already_rewarded" | "referrer_missing" };

/**
 * Call after an artwork is created. Grants the referrer their months once, on the referred
 * artist's first approved upload. Safe to call more than once.
 */
export async function rewardReferralOnUpload(artistId: string): Promise<RewardResult> {
  const me = await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true, referredById: true } });
  if (!me?.referredById || me.referredById === me.id) return { granted: false, reason: "not_referred" };
  const approved = await prisma.artwork.count({ where: { artistId, status: "APPROVED" } });
  if (approved < 1) return { granted: false, reason: "not_approved" };

  const referrerId = me.referredById;
  return prisma.$transaction(async (tx) => {
    // Lock the referrer row so two uploads at once can't both grant.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Artist" WHERE id = ${referrerId} FOR UPDATE`;
    if (!locked.length) return { granted: false, reason: "referrer_missing" } as const;
    const done = await tx.message.findFirst({ where: { artistId: referrerId, direction: REFERRAL_DIRECTION, email: ledgerEmail(artistId) }, select: { id: true } });
    if (done) return { granted: false, reason: "already_rewarded" } as const;

    const ref = await tx.artist.findUnique({ where: { id: referrerId }, select: { proUntil: true } });
    const now = new Date();
    const from = isProActive(ref, now) ? ref!.proUntil! : now;
    const ceiling = addMonths(now, REFERRALS.maxBankedMonths);
    const wanted = addMonths(from, REFERRALS.rewardMonths);
    const proUntil = wanted > ceiling ? ceiling : wanted;
    const capped = wanted > ceiling;

    await tx.artist.update({ where: { id: referrerId }, data: { proUntil } });
    await tx.message.create({
      data: {
        artistId: referrerId,
        email: ledgerEmail(artistId),
        direction: REFERRAL_DIRECTION,
        subject: "Referral reward",
        body: `+${REFERRALS.rewardMonths} months of Infinity${capped ? " (capped at 12 months banked)" : ""}. Infinity until ${proUntil.toISOString()}.`,
        sentAt: now,
      },
    });
    console.info("REFERRAL_REWARD", JSON.stringify({ referrerId, referredId: artistId, proUntil: proUntil.toISOString(), capped }));
    return { granted: true, referrerId, proUntil, capped } as const;
  });
}

export type ReferralStatus = "joined" | "uploaded" | "rewarded";

/** Everyone this artist referred, newest first, with their status. */
export async function getReferrals(artistId: string) {
  const [rows, ledger] = await Promise.all([
    prisma.artist.findMany({
      where: { referredById: artistId },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, artist_name: true, name: true, createdAt: true, _count: { select: { artworks: { where: { status: "APPROVED" } } } } },
    }),
    prisma.message.findMany({ where: { artistId, direction: REFERRAL_DIRECTION }, select: { email: true, createdAt: true } }),
  ]);
  const rewarded = new Map(ledger.map((m) => [m.email.replace(/^ref:/, ""), m.createdAt]));
  return rows.map((r) => {
    const rewardedAt = rewarded.get(r.id) ?? null;
    const status: ReferralStatus = rewardedAt ? "rewarded" : r._count.artworks > 0 ? "uploaded" : "joined";
    return { id: r.id, handle: r.slug, name: r.artist_name || r.name, joined: r.createdAt, status, rewardedAt };
  });
}

export type ReferralRow = Awaited<ReturnType<typeof getReferrals>>[number];
