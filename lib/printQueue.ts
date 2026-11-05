// Print queue (/studio/qr/queue): codes an artist wants printed, saved in the database so it follows them across
// devices. Server only. Every item holds the piece's real short-link code (made when it's added, if needed), so what
// prints is what scans. Mixed sheets come from generateMixedQrPdf (lib/generateQrPdf.ts).
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureArtworkCode, shortUrl } from "@/lib/shortlinks";
import { DEFAULT_DESIGN, FORMATS, PRESETS, presetLook, sanitizeDesign, type ArtInfo, type Design, type FormatKey, type PresetKey } from "@/components/qr/card";
import { FORMAT_ORDER, QUEUE_MAX_ITEMS, QUEUE_MAX_QTY } from "@/lib/printQueueFormat";
import type { CardJob } from "@/lib/generateQrPdf";

export const queueArtSelect = {
  id: true, slug: true, title: true, imageUrl: true, status: true, sensitive: true, editionSize: true,
  markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true,
  artist: { select: { name: true, artist_name: true } },
} as const;

type ArtRow = { slug: string | null; title: string; imageUrl: string; sensitive: string[]; editionSize: number | null; markupSmall: number | null; markupMedium: number | null; markupLarge: number | null; markupXl: number | null; artist: { name: string; artist_name: string | null } | null };

export function artInfoOf(r: ArtRow): ArtInfo {
  return {
    slug: r.slug || "",
    title: r.title,
    artist: r.artist?.artist_name || r.artist?.name || "",
    imageUrl: r.imageUrl,
    sensitive: r.sensitive,
    edition: r.editionSize,
    markups: { small: r.markupSmall || 0, medium: r.markupMedium || 0, large: r.markupLarge || 0, xl: r.markupXl || 0 },
  };
}

export const clampQty = (v: unknown, d = 1) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(1, Math.min(QUEUE_MAX_QTY, n)) : d;
};

export const isFormat = (v: unknown): v is FormatKey => typeof v === "string" && v in FORMATS;
export const isPreset = (v: unknown): v is PresetKey => typeof v === "string" && v in PRESETS;

/**
 * The artist's last-used look: their newest queue item, else their newest saved code. Only the look carries over;
 * a plain code has no venue or discount, so those are cleared.
 */
export async function lastLook(artistId: string): Promise<Design> {
  const q = await prisma.printQueueItem.findFirst({ where: { artistId }, orderBy: { updatedAt: "desc" }, select: { design: true } });
  const c = q ? null : await prisma.qrCode.findFirst({ where: { artistId, design: { not: Prisma.DbNull } }, orderBy: { createdAt: "desc" }, select: { design: true } });
  const raw = q?.design ?? c?.design;
  return plainDesign(raw ? sanitizeDesign(raw) : DEFAULT_DESIGN);
}

/** A look without venue, discount or end date: those live on the code record, and a plain code has none. */
export const plainDesign = (d: Design): Design => ({ ...d, disc: 0, coupon: "", ev: "", evPrint: false, end: "never" });

/** The look for "Gallery label" etc., or the last-used one. */
export async function lookFor(artistId: string, look: unknown): Promise<Design> {
  if (isPreset(look)) return plainDesign({ ...DEFAULT_DESIGN, ...presetLook(look), preset: look });
  if (isFormat(look)) {
    const last = await lastLook(artistId);
    if (last.format === look) return last;
    const k = (Object.keys(PRESETS) as PresetKey[]).find((p) => PRESETS[p].format === look)!;
    return plainDesign({ ...DEFAULT_DESIGN, ...presetLook(k), preset: k });
  }
  return lastLook(artistId);
}

/** Add (or top up) one code in one format. Same code + format again adds to qty and takes the newer look. */
export async function addToQueue(artistId: string, input: { artworkId: string; qrCodeId: string; design: Design; qty: number }) {
  const count = await prisma.printQueueItem.count({ where: { artistId } });
  const format = input.design.format;
  const existing = await prisma.printQueueItem.findUnique({ where: { artistId_qrCodeId_format: { artistId, qrCodeId: input.qrCodeId, format } }, select: { id: true, qty: true } });
  if (!existing && count >= QUEUE_MAX_ITEMS) throw Object.assign(new Error(`Your queue holds up to ${QUEUE_MAX_ITEMS} codes. Print some first.`), { code: "queue_full" });
  if (existing) {
    return prisma.printQueueItem.update({ where: { id: existing.id }, data: { qty: Math.min(QUEUE_MAX_QTY, existing.qty + input.qty), design: input.design as object } });
  }
  return prisma.printQueueItem.create({ data: { artistId, artworkId: input.artworkId, qrCodeId: input.qrCodeId, format, design: input.design as object, qty: input.qty } });
}

/** Pieces this artist can queue: their own, live or in review, with a slug. */
export function queueableArt(artistId: string, where: { slug?: { in: string[] } } = {}) {
  return prisma.artwork.findMany({ where: { artistId, status: { in: ["APPROVED", "PENDING"] }, slug: { not: null, ...(where.slug ?? {}) } }, select: queueArtSelect, orderBy: { createdAt: "desc" } });
}

/** Add pieces by slug with one look, each with its plain code (reused if it exists, made if not). */
export async function addPieces(artistId: string, slugs: string[] | "all", look: unknown, qty = 1) {
  const rows = await queueableArt(artistId, slugs === "all" ? {} : { slug: { in: slugs.slice(0, QUEUE_MAX_ITEMS) } });
  const design = await lookFor(artistId, look);
  let added = 0;
  for (const r of rows) {
    const code = await ensureArtworkCode(artistId, r.id, `${r.title} · ${FORMATS[design.format].name}`, design);
    const qr = await prisma.qrCode.findUnique({ where: { code }, select: { id: true } });
    if (!qr) continue;
    await addToQueue(artistId, { artworkId: r.id, qrCodeId: qr.id, design, qty });
    added++;
  }
  return { added, design };
}

const itemSelect = {
  id: true, format: true, qty: true, design: true, createdAt: true, artworkId: true, qrCodeId: true,
  qrCode: { select: { id: true, code: true, venue: true, discountPct: true, active: true, expiresAt: true } },
  artwork: { select: queueArtSelect },
} as const;

export type QueueRow = Awaited<ReturnType<typeof loadQueue>>[number];

export function loadQueue(artistId: string) {
  return prisma.printQueueItem.findMany({ where: { artistId }, select: itemSelect, orderBy: { createdAt: "asc" } });
}

/** The queue as print jobs, grouped by format in FORMAT_ORDER. */
export function jobsByFormat(rows: QueueRow[], base: string) {
  const out = new Map<FormatKey, { row: QueueRow; job: CardJob; qty: number }[]>();
  for (const f of FORMAT_ORDER) out.set(f, []);
  for (const r of rows) {
    const design = sanitizeDesign(r.design);
    if (!isFormat(r.format)) continue;
    const fixed = { ...design, format: r.format };
    out.get(r.format)!.push({ row: r, qty: r.qty, job: { design: fixed, art: artInfoOf(r.artwork), qrText: shortUrl(r.qrCode.code, base) } });
  }
  return out;
}

export async function queueCount(artistId: string) {
  const r = await prisma.printQueueItem.aggregate({ where: { artistId }, _sum: { qty: true } }).catch(() => null);
  return r?._sum.qty ?? 0;
}
