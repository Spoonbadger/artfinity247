// Artist analytics for Studio (server only): page views, visitors, scans and sales over one window.
// Every number uses the same [from, now) window so the tiles agree with each other.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { countArtistScans } from "@/lib/shortlinks";

const DAY = 86400000;
export const TZ = "America/New_York"; // same as Studio's STUDIO_TZ
export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const parseRange = (v: unknown): Range => (RANGES.find((r) => String(r) === v) ?? 30);

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

export type Day = { key: string; label: string; views: number; visitors: number; scans: number; sales: number };
export type SourceRow = { source: string; views: number; visitors: number; sales: number | null };
export type ArtRow = { id: string; title: string; slug: string | null; imageUrl: string | null; views: number; visitors: number; scans: number; sales: number };
export type Analytics = {
  range: Range;
  from: Date;
  to: Date;
  views: number;
  visitors: number;
  scans: number;
  sales: number;
  qrSales: number;
  everViewed: boolean;
  days: Day[];
  sources: SourceRow[];
  devices: { device: string; views: number }[];
  artworks: ArtRow[];
};

type Count = { k: string | null; views: number; visitors: number };

export async function getArtistAnalytics(artistId: string, range: Range, now = new Date()): Promise<Analytics> {
  const from = new Date(now.getTime() - range * DAY);
  const win = Prisma.sql`"artistId" = ${artistId} AND "createdAt" >= ${from} AND "createdAt" < ${now}`;
  const localDay = (col: string) => Prisma.raw(`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}', 'YYYY-MM-DD')`);
  const group = (col: Prisma.Sql) =>
    prisma.$queryRaw<Count[]>`SELECT ${col} AS k, count(*)::int AS views, count(DISTINCT "visitorId")::int AS visitors FROM "PageView" WHERE ${win} GROUP BY 1`;

  const [totals, byDay, bySource, byDevice, byArt, scanDays, scans, items, ever, scansByArtRows] = await Promise.all([
    prisma.$queryRaw<{ views: number; visitors: number }[]>`SELECT count(*)::int AS views, count(DISTINCT "visitorId")::int AS visitors FROM "PageView" WHERE ${win}`,
    group(localDay(`"createdAt"`)),
    group(Prisma.raw(`"source"`)),
    group(Prisma.raw(`COALESCE("device", 'unknown')`)),
    prisma.$queryRaw<Count[]>`SELECT "artworkId" AS k, count(*)::int AS views, count(DISTINCT "visitorId")::int AS visitors FROM "PageView" WHERE ${win} AND "artworkId" IS NOT NULL GROUP BY 1`,
    prisma.$queryRaw<{ k: string; n: number }[]>`
      SELECT ${localDay(`s."createdAt"`)} AS k, count(*)::int AS n FROM "ScanEvent" s JOIN "QrCode" q ON q."id" = s."qrCodeId"
      WHERE q."artistId" = ${artistId} AND s."createdAt" >= ${from} AND s."createdAt" < ${now} GROUP BY 1`,
    countArtistScans(artistId, from, now),
    prisma.orderItem.findMany({
      where: { artwork: { artistId }, order: { paymentStatus: "paid", kind: { not: "bulk" }, createdAt: { gte: from, lt: now } } },
      select: { artworkId: true, qrCodeId: true, order: { select: { createdAt: true } } },
    }),
    prisma.pageView.findFirst({ where: { artistId }, select: { id: true } }),
    prisma.$queryRaw<{ k: string; n: number }[]>`
      SELECT q."artworkId" AS k, count(*)::int AS n FROM "ScanEvent" s JOIN "QrCode" q ON q."id" = s."qrCodeId"
      WHERE q."artistId" = ${artistId} AND q."artworkId" IS NOT NULL AND s."createdAt" >= ${from} AND s."createdAt" < ${now} GROUP BY 1`,
  ]);

  // Days, oldest first, in Studio's time zone.
  const days: Day[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    days.push({ key: dayKey(d), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ }), views: 0, visitors: 0, scans: 0, sales: 0 });
  }
  const at = new Map(days.map((d, i) => [d.key, i]));
  for (const r of byDay) { const i = at.get(r.k!); if (i !== undefined) { days[i].views = r.views; days[i].visitors = r.visitors; } }
  for (const r of scanDays) { const i = at.get(r.k); if (i !== undefined) days[i].scans = r.n; }
  for (const it of items) { const i = at.get(dayKey(it.order.createdAt)); if (i !== undefined) days[i].sales++; }

  // Sales by source: only QR sales can be traced (OrderItem.qrCodeId). Orders don't carry a visitor id.
  const qrSales = items.filter((it) => it.qrCodeId).length;
  const sources: SourceRow[] = bySource
    .map((r) => ({ source: r.k || "direct", views: r.views, visitors: r.visitors, sales: r.k === "qr" ? qrSales : null }))
    .sort((a, b) => b.views - a.views);
  if (qrSales && !sources.some((s) => s.source === "qr")) sources.push({ source: "qr", views: 0, visitors: 0, sales: qrSales });

  // Top artworks: anything viewed, scanned or sold in the window.
  const salesByArt = new Map<string, number>();
  for (const it of items) if (it.artworkId) salesByArt.set(it.artworkId, (salesByArt.get(it.artworkId) || 0) + 1);
  const scansByArt = new Map(scansByArtRows.map((r) => [r.k, r.n]));
  const ids = Array.from(new Set([...byArt.map((r) => r.k!), ...Array.from(salesByArt.keys()), ...Array.from(scansByArt.keys())]));
  const arts = ids.length
    ? await prisma.artwork.findMany({ where: { id: { in: ids }, artistId }, select: { id: true, title: true, slug: true, imageUrl: true } })
    : [];
  const viewsByArt = new Map(byArt.map((r) => [r.k!, r]));
  const artworks: ArtRow[] = arts
    .map((a) => ({ ...a, views: viewsByArt.get(a.id)?.views || 0, visitors: viewsByArt.get(a.id)?.visitors || 0, scans: scansByArt.get(a.id) || 0, sales: salesByArt.get(a.id) || 0 }))
    .sort((a, b) => b.views - a.views || b.sales - a.sales);

  const order = ["mobile", "desktop", "tablet", "unknown"];
  return {
    range, from, to: now,
    views: totals[0]?.views || 0,
    visitors: totals[0]?.visitors || 0,
    scans,
    sales: items.length,
    qrSales,
    everViewed: !!ever,
    days,
    sources,
    devices: byDevice.map((r) => ({ device: r.k || "unknown", views: r.views })).sort((a, b) => order.indexOf(a.device) - order.indexOf(b.device)),
    artworks,
  };
}

/** sales ÷ unique visitors, as "2.4%". A dash when nobody visited. */
export function conversion(sales: number, visitors: number) {
  if (!visitors) return "–";
  const p = (sales / visitors) * 100;
  return `${p >= 10 || p === 0 ? Math.round(p) : p.toFixed(1)}%`;
}
