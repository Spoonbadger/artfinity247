// Printed labels (CodePrint): record what each printed card says, and find the ones that are out of date. Server only.
//
// Recorded whenever a card is produced for printing: QR Studio downloads (PDF, SVG), "Print all my codes", the bulk
// gallery-label PDF, the print queue's "Mark as printed", a paid "we print them for you" order. Only cards that show a
// price are recorded (lib/labelFacts.ts labelFacts returns null otherwise).
//
// Out of date: the code's latest unreplaced print shows a different price, discount or title than the code would
// print now (its saved look, its current discount, its artwork's current title and prices). "Mark old labels as
// replaced" sets replacedAt on every unreplaced print of the code; a new print starts fresh.
import { prisma } from "@/lib/prisma";
import { diffLabel, labelFacts, nowFacts, type LabelDiff, type LabelFacts, type PrintedLabel } from "@/lib/labelFacts";
import { addToQueue } from "@/lib/printQueue";
import { QUEUE_MAX_QTY } from "@/lib/printQueueFormat";
import { sanitizeDesign, type ArtInfo } from "@/components/qr/card";

export type PrintSource = "download" | "print_all" | "queue" | "order";

type Markups = { markupSmall: number | null; markupMedium: number | null; markupLarge: number | null; markupXl: number | null };
export const markupsOf = (r: Markups): ArtInfo["markups"] => ({ small: r.markupSmall || 0, medium: r.markupMedium || 0, large: r.markupLarge || 0, xl: r.markupXl || 0 });

export type PrintRecord = {
  qrCodeId: string;
  artistId: string;
  artworkId: string | null;
  design: unknown;
  art: Pick<ArtInfo, "title" | "markups">;
  qty: number;
  source: PrintSource;
  /** Defaults to the code's Place now. */
  placeId?: string | null;
};

/** Saves what each card says. Never throws: a print must not fail because its record didn't save. */
export async function recordPrints(rows: PrintRecord[]) {
  try {
    const data = [];
    if (!rows.length) return 0;
    // Codes that still exist (a mailed order's snapshot can outlive one), with their Place now.
    const places = new Map((await prisma.qrCode.findMany({ where: { id: { in: Array.from(new Set(rows.map((r) => r.qrCodeId))) } }, select: { id: true, placeId: true } })).map((c) => [c.id, c.placeId]));
    for (const r of rows) {
      if (!places.has(r.qrCodeId)) continue;
      const f = labelFacts(r.design, r.art);
      if (!f) continue;
      data.push({
        qrCodeId: r.qrCodeId, artistId: r.artistId, artworkId: r.artworkId, placeId: r.placeId === undefined ? places.get(r.qrCodeId) ?? null : r.placeId,
        format: f.format, style: f.style, ink: f.ink, qty: Math.max(1, Math.round(r.qty) || 1),
        priceShownCents: f.priceCents, discountPct: f.discountPct, title: f.title, design: f.design as object, source: r.source,
      });
    }
    if (data.length) await prisma.codePrint.createMany({ data });
    return data.length;
  } catch (e) {
    console.error("[labels] recording a print failed", e);
    return 0;
  }
}

const codeSelect = {
  id: true, code: true, design: true, discountPct: true, artworkId: true,
  artwork: { select: { id: true, title: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true } },
} as const;

export type LabelState = PrintedLabel & { id: string; qrCodeId: string; artworkId: string | null; diffs: LabelDiff[]; format: string; style: string; design: unknown; source: string };

/**
 * The latest unreplaced print of each of the artist's codes (optionally only some codes, or one artwork's), with what
 * the code would print now and what no longer matches. Codes never printed with a price aren't in the map.
 */
export async function latestLabels(artistId: string, only: { qrCodeIds?: string[]; artworkId?: string } = {}): Promise<Map<string, LabelState>> {
  const rows = await prisma.codePrint.findMany({
    where: {
      artistId, replacedAt: null,
      ...(only.qrCodeIds ? { qrCodeId: { in: only.qrCodeIds } } : {}),
      ...(only.artworkId ? { qrCode: { artworkId: only.artworkId } } : {}),
    },
    orderBy: [{ printedAt: "desc" }],
    distinct: ["qrCodeId"],
    select: { id: true, qrCodeId: true, artworkId: true, format: true, style: true, qty: true, priceShownCents: true, discountPct: true, title: true, design: true, source: true, printedAt: true, qrCode: { select: codeSelect } },
  });
  const out = new Map<string, LabelState>();
  for (const r of rows) {
    const printed: LabelFacts = { priceCents: r.priceShownCents, discountPct: r.discountPct, title: r.title };
    const c = r.qrCode;
    const showsTitle = !!r.title;
    // A code repointed at the artist's page: nothing to compare the price with, but the label names a painting.
    const now: LabelFacts = c.artwork
      ? nowFacts({ design: r.design ?? c.design, discountPct: c.discountPct }, { title: c.artwork.title, markups: markupsOf(c.artwork) }, showsTitle)
      : { priceCents: r.priceShownCents, discountPct: c.discountPct || 0, title: showsTitle ? "Your page" : "" };
    out.set(r.qrCodeId, {
      id: r.id, qrCodeId: r.qrCodeId, artworkId: r.artworkId, code: c.code, qty: r.qty, printedAt: r.printedAt.toISOString(),
      ...printed, now, showsTitle, codeDiscount: c.discountPct || 0, diffs: diffLabel(printed, now),
      format: r.format, style: r.style, design: r.design, source: r.source,
    });
  }
  return out;
}

/** Codes whose printed label is out of date. */
export async function staleLabels(artistId: string, only: { qrCodeIds?: string[]; artworkId?: string } = {}) {
  return Array.from((await latestLabels(artistId, only)).values()).filter((l) => l.diffs.length > 0);
}

/** For the Studio forms: the printed labels as plain data (no Dates). */
export const formLabels = (m: Map<string, LabelState>): PrintedLabel[] =>
  Array.from(m.values()).map(({ code, qty, printedAt, priceCents, discountPct, title, now, showsTitle, codeDiscount }) => ({ code, qty, printedAt, priceCents, discountPct, title, now, showsTitle, codeDiscount }));

/**
 * "Reprint": put codes back in the print queue with their last printed look, carrying the code's current discount
 * (the new card then matches what scans show). Returns how many codes were queued.
 */
export async function reprintCodes(artistId: string, codes: string[]) {
  const rows = await prisma.qrCode.findMany({
    where: { artistId, code: { in: codes.slice(0, 200) }, artworkId: { not: null } },
    select: { id: true, artworkId: true, design: true, discountPct: true, placeId: true, codePrints: { orderBy: { printedAt: "desc" }, take: 1, select: { design: true, qty: true, source: true } } },
  });
  let queued = 0;
  for (const r of rows) {
    const last = r.codePrints[0];
    const design = sanitizeDesign({ ...sanitizeDesign(last?.design ?? r.design), disc: r.discountPct || 0 });
    // A sheet download filled the page; a queue or mailed order said how many on purpose.
    const qty = last && (last.source === "queue" || last.source === "order") ? Math.min(QUEUE_MAX_QTY, last.qty) : 1;
    await addToQueue(artistId, { artworkId: r.artworkId!, qrCodeId: r.id, design, qty });
    if (r.placeId) await prisma.printQueueItem.updateMany({ where: { artistId, qrCodeId: r.id, format: design.format }, data: { placeId: r.placeId } });
    queued++;
  }
  return queued;
}

/** "Mark old labels as replaced". Returns the print ids it changed, so Undo can put them back. */
export async function markReplaced(artistId: string, codes: string[]) {
  const rows = await prisma.codePrint.findMany({ where: { artistId, replacedAt: null, qrCode: { code: { in: codes.slice(0, 500) } } }, select: { id: true } });
  if (!rows.length) return [];
  await prisma.codePrint.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { replacedAt: new Date() } });
  return rows.map((r) => r.id);
}

export async function unmarkReplaced(artistId: string, ids: string[]) {
  const r = await prisma.codePrint.updateMany({ where: { artistId, id: { in: ids.slice(0, 500) } }, data: { replacedAt: null } });
  return r.count;
}
