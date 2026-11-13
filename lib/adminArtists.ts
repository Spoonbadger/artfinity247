// The admin artists list: filters, unpaid balances and stats in a few queries. Server only.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { itemBreakdown } from "@/lib/sales";
import { getBalance, utcMonth } from "@/lib/balance";
import { activeRefunds, refundAdjustments, shareAfterRefund } from "@/lib/refunds";
import { isProActive } from "@/lib/plans";
import { connectStatus, type ConnectStatus } from "@/lib/stripeConnect";

// role: "artists" | "admins" (any by default) · email: "unverified" · signin: "social" (no password) · joined: "7d"
export type ArtistFilters = { q?: string; verified?: string; status?: string; balance?: string; plan?: string; stripe?: string; role?: string; email?: string; signin?: string; joined?: string };
export const ARTIST_FILTER_KEYS = ["q", "verified", "status", "balance", "plan", "stripe", "role", "email", "signin", "joined"] as const;

export type ArtistListRow = {
  id: string; name: string; slug: string; email: string; city: string; createdAt: Date; role: string;
  verification: string; suspended: boolean; closed: boolean; infinity: boolean; proUntil: Date | null;
  stripe: ConnectStatus; live: number; prints: number; salesCents: number; balanceCents: number;
  adminRole: string | null; emailVerified: boolean; hasPassword: boolean; providers: string[];
};

/**
 * Unpaid balance per artist (pending + available, the same as getBalance): every paid sale's share in a month
 * that has no paid Payout, after reversed refunds.
 */
export async function unpaidBalances(artistIds?: string[]) {
  const items = await prisma.orderItem.findMany({
    where: { order: { paymentStatus: "paid", kind: { not: "bulk" } }, artwork: artistIds ? { artistId: { in: artistIds } } : { isNot: null } },
    select: { id: true, orderId: true, lineTotal: true, unitPrice: true, quantity: true, size: true, frameChosen: true, artistSplit: true, artwork: { select: { artistId: true } }, order: { select: { createdAt: true } } },
  });
  const [paid, refunds] = await Promise.all([
    prisma.payout.findMany({ where: { paidAt: { not: null }, ...(artistIds ? { artistId: { in: artistIds } } : {}) }, select: { artistId: true, month: true } }),
    activeRefunds(Array.from(new Set(items.map((i) => i.orderId)))),
  ]);
  const paidSet = new Set(paid.map((p) => `${p.artistId}:${p.month}`));
  const out = new Map<string, { balanceCents: number; prints: number; salesCents: number }>();
  for (const it of items) {
    const artistId = it.artwork!.artistId;
    const b = itemBreakdown({ ...it, orderDate: it.order.createdAt });
    const r = out.get(artistId) ?? { balanceCents: 0, prints: 0, salesCents: 0 };
    const refund = refunds.get(it.id);
    if (!refund) { r.prints += b.quantity; r.salesCents += b.lineTotal; }
    if (!paidSet.has(`${artistId}:${utcMonth(it.order.createdAt)}`)) r.balanceCents += shareAfterRefund(b.artistShare, refund);
    out.set(artistId, r);
  }
  // Refund adjustments carry forward across months (lib/balance.ts): take those few artists' balance from getBalance.
  const withAdj = new Set((await refundAdjustments()).map((a) => a.artistId));
  for (const artistId of Array.from(withAdj)) {
    if (artistIds && !artistIds.includes(artistId)) continue;
    const bal = await getBalance(artistId);
    const r = out.get(artistId) ?? { balanceCents: 0, prints: 0, salesCents: 0 };
    r.balanceCents = bal.pendingCents + bal.availableCents;
    out.set(artistId, r);
  }
  return out;
}

export async function listArtists(f: ArtistFilters): Promise<ArtistListRow[]> {
  const and: Prisma.ArtistWhereInput[] = [];
  const q = f.q?.trim().replace(/^@/, "");
  if (q) {
    const ci = { contains: q, mode: "insensitive" as const };
    and.push({ OR: [{ name: ci }, { artist_name: ci }, { first_name: ci }, { last_name: ci }, { slug: ci }, { email: ci }, { city: ci }] });
  }
  if (f.verified === "yes") and.push({ verification: "VERIFIED" });
  else if (f.verified === "pending") and.push({ verification: "PENDING" });
  else if (f.verified === "no") and.push({ verification: { in: ["NONE", "REJECTED"] } });
  if (f.status === "active") and.push({ closedAt: null, suspendedAt: null });
  else if (f.status === "suspended") and.push({ suspendedAt: { not: null } });
  else if (f.status === "closed") and.push({ closedAt: { not: null } });
  if (f.role === "admins") and.push({ role: "ADMIN" });
  else if (f.role === "artists") and.push({ role: "USER" });
  if (f.email === "unverified") and.push({ emailVerifiedAt: null });
  if (f.signin === "social") and.push({ password: null });
  const now = new Date();
  if (f.joined === "7d") and.push({ createdAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } });
  if (f.plan === "infinity") and.push({ proUntil: { gt: now } });
  else if (f.plan === "free") and.push({ OR: [{ proUntil: null }, { proUntil: { lte: now } }] });
  const where: Prisma.ArtistWhereInput = and.length ? { AND: and } : {};

  const artists = await prisma.artist.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 2000,
    select: {
      id: true, name: true, artist_name: true, slug: true, email: true, city: true, createdAt: true, role: true, verification: true,
      suspendedAt: true, closedAt: true, proUntil: true, stripeAccountId: true, stripePayoutsEnabled: true,
      adminRole: true, emailVerifiedAt: true, password: true, oauthAccounts: { select: { provider: true } },
      _count: { select: { artworks: { where: { status: "APPROVED" } } } },
    },
  });
  const money = await unpaidBalances(artists.map((a) => a.id));
  let rows: ArtistListRow[] = artists.map((a) => {
    const m = money.get(a.id);
    return {
      id: a.id, name: a.artist_name || a.name, slug: a.slug, email: a.email, city: a.city, createdAt: a.createdAt, role: a.role,
      verification: a.verification, suspended: !!a.suspendedAt, closed: !!a.closedAt, infinity: isProActive(a), proUntil: a.proUntil,
      stripe: connectStatus(a), live: a._count.artworks,
      prints: m?.prints ?? 0, salesCents: m?.salesCents ?? 0, balanceCents: m?.balanceCents ?? 0,
      // Only whether a password exists ever leaves this function, never the hash.
      adminRole: a.role === "ADMIN" ? a.adminRole : null, emailVerified: !!a.emailVerifiedAt, hasPassword: !!a.password,
      providers: Array.from(new Set(a.oauthAccounts.map((o) => o.provider))),
    };
  });
  if (f.balance === "1") rows = rows.filter((r) => r.balanceCents > 0);
  if (f.stripe === "pending") rows = rows.filter((r) => r.stripe === "pending");
  else if (f.stripe === "ready") rows = rows.filter((r) => r.stripe === "ready");
  else if (f.stripe === "none") rows = rows.filter((r) => r.stripe === "not_connected");
  return rows;
}
