// Server data for My codes (/studio/codes).
import { prisma } from "@/lib/prisma";
import { isLive, statsFor, type CodeStats } from "@/lib/shortlinks";
import { dayKey, STUDIO_TZ } from "../_lib/data";

const DAY = 86400000;

const codeSelect = {
  id: true, code: true, label: true, venue: true, discountPct: true, active: true, expiresAt: true, createdAt: true, design: true, artworkId: true,
  artwork: { select: { id: true, title: true, slug: true, imageUrl: true, status: true } },
} as const;

export type CodeRow = Awaited<ReturnType<typeof loadCodes>>[number] & { stats: CodeStats; live: boolean };

function loadCodes(artistId: string) {
  return prisma.qrCode.findMany({ where: { artistId }, select: codeSelect, orderBy: { createdAt: "desc" } });
}

export async function getCodes(artistId: string): Promise<CodeRow[]> {
  const rows = await loadCodes(artistId);
  const stats = await statsFor(rows.map((r) => r.id));
  const now = new Date();
  return rows.map((r) => ({ ...r, stats: stats.get(r.id)!, live: isLive(r, now) }));
}

export async function getCode(artistId: string, code: string) {
  const row = await prisma.qrCode.findFirst({ where: { artistId, code }, select: codeSelect });
  if (!row) return null;
  const now = new Date();
  const since = new Date(now.getTime() - 60 * DAY);
  const [stats, scans, cities, devices, recent] = await Promise.all([
    statsFor([row.id]),
    prisma.scanEvent.findMany({ where: { qrCodeId: row.id, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.scanEvent.groupBy({ by: ["city", "region"], where: { qrCodeId: row.id }, _count: { _all: true } }),
    prisma.scanEvent.groupBy({ by: ["device"], where: { qrCodeId: row.id }, _count: { _all: true } }),
    prisma.scanEvent.findMany({ where: { qrCodeId: row.id }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, createdAt: true, city: true, region: true, device: true } }),
  ]);

  const days: { key: string; label: string; n: number }[] = [];
  for (let i = 59; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY);
    days.push({ key: dayKey(d), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: STUDIO_TZ }), n: 0 });
  }
  const idx = new Map(days.map((d, i) => [d.key, i]));
  for (const s of scans) { const i = idx.get(dayKey(s.createdAt)); if (i !== undefined) days[i].n++; }

  const place = (c: string | null, r: string | null) => (c ? (r ? `${c}, ${r}` : c) : "Unknown");
  return {
    ...row,
    live: isLive(row, now),
    stats: stats.get(row.id)!,
    days,
    cities: cities.map((c) => ({ name: place(c.city, c.region), n: c._count._all, unknown: !c.city })).sort((a, b) => Number(a.unknown) - Number(b.unknown) || b.n - a.n),
    devices: devices.map((d) => ({ name: d.device || "unknown", n: d._count._all })).sort((a, b) => b.n - a.n),
    recent: recent.map((s) => ({ id: s.id, at: s.createdAt.toISOString(), place: place(s.city, s.region), device: s.device || "unknown" })),
  };
}

export const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(a / b < 0.1 ? 1 : 0)}%` : "None yet");

export function status(c: { active: boolean; expiresAt: Date | null; live: boolean }) {
  if (c.live) return { text: "Active", on: true };
  if (!c.active) return { text: "Paused", on: false };
  return { text: "Ended", on: false };
}
