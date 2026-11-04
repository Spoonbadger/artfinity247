// Trust signals for artists: prints sold (medals) and real, admin-reviewed verification.
// One batched query per list, so cards and directories don't run a query per artist.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { medalFor, type MedalTier } from "@/lib/medals";

export type Trust = {
  /** Paid prints (sum of order item quantities on paid retail orders). Bulk orders an artist places for themself don't count. */
  printsSold: number;
  /** Medal to show publicly. Null when none earned, or when the artist hid medals on their page design. */
  medal: MedalTier | null;
  /** Medal actually earned, regardless of the artist's display choice (Studio uses this). */
  earned: MedalTier | null;
  /** Whether the artist chose to show medals and sales count (pageTheme.showStats, default true). */
  showStats: boolean;
  /** A person at Artfinity checked this artist (Artist.verification === "VERIFIED"). */
  verified: boolean;
  verifiedAt: string | null;
};

export const NO_TRUST: Trust = { printsSold: 0, medal: null, earned: null, showStats: true, verified: false, verifiedAt: null };

function showStatsFrom(theme: Prisma.JsonValue | null | undefined) {
  if (theme && typeof theme === "object" && !Array.isArray(theme)) {
    const v = (theme as Record<string, unknown>).showStats;
    if (typeof v === "boolean") return v;
  }
  return true;
}

async function soldBy(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await prisma.$queryRaw<{ artistId: string; n: number }[]>`
    SELECT a."artistId" AS "artistId", COALESCE(SUM(COALESCE(oi.quantity, 1)), 0)::int AS n
    FROM "OrderItem" oi
    JOIN "Artwork" a ON a.id = oi."artworkId"
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o."paymentStatus" = 'paid' AND o.kind <> 'bulk' AND a."artistId" = ANY(${ids}::text[])
    GROUP BY a."artistId"`;
  return new Map(rows.map((r) => [r.artistId, Number(r.n) || 0]));
}

type Row = { id: string; slug: string; verification: string; verifiedAt: Date | null; pageTheme: Prisma.JsonValue | null };

async function build(rows: Row[]) {
  const sold = await soldBy(rows.map((r) => r.id));
  return rows.map((r) => {
    const printsSold = sold.get(r.id) ?? 0;
    const earned = medalFor(printsSold)?.tier ?? null;
    const showStats = showStatsFrom(r.pageTheme);
    const verified = r.verification === "VERIFIED";
    const t: Trust = {
      printsSold,
      earned,
      showStats,
      medal: showStats ? earned : null,
      verified,
      verifiedAt: verified && r.verifiedAt ? r.verifiedAt.toISOString() : null,
    };
    return [r, t] as const;
  });
}

const select = { id: true, slug: true, verification: true, verifiedAt: true, pageTheme: true } as const;

/** Trust for many artists at once, keyed by artist id. Missing ids get NO_TRUST via `.get(id) ?? NO_TRUST`. */
export async function getTrust(artistIds: string[]): Promise<Map<string, Trust>> {
  const ids = Array.from(new Set(artistIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const rows = await prisma.artist.findMany({ where: { id: { in: ids } }, select });
  return new Map((await build(rows)).map(([r, t]) => [r.id, t]));
}

/** Same as getTrust, keyed by artist slug (for lists that only carry slugs). */
export async function getTrustBySlug(slugs: string[]): Promise<Map<string, Trust>> {
  const list = Array.from(new Set(slugs.filter(Boolean)));
  if (!list.length) return new Map();
  const rows = await prisma.artist.findMany({ where: { slug: { in: list } }, select });
  return new Map((await build(rows)).map(([r, t]) => [r.slug, t]));
}

/** One artist. */
export async function getArtistTrust(artistId: string): Promise<Trust> {
  return (await getTrust([artistId])).get(artistId) ?? NO_TRUST;
}
