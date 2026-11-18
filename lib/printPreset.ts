// Print codes: which pieces start ticked, from the link that opened the screen. Server only.
//   ?pieces=slug,slug   those pieces (slugs or ids), 1 copy each in their usual size; ?pieces=all ticks every piece
//   ?code=K7P2,AB3C     those codes' pieces, printing with those codes ("Print this code", "Reprint")
//   ?size=sticker       the size for the pieces above
//   ?copies=3           copies of each
//   ?place=<id>         every piece hanging at that Place, with its code there (made if missing)
// Codes still sitting in the old print queue (PrintQueueItem) also start ticked, with their size and copies, until
// the artist prints once (POST /api/studio/print clears them).
import { prisma } from "@/lib/prisma";
import { placeCodes } from "@/lib/artistPlaces";
import { isSize, clampCopies, type SizeKey } from "@/lib/printOptions";
import type { Preset } from "@/components/print/PrintCodes";

export type PresetParams = { pieces?: string; code?: string; size?: string; copies?: string; place?: string };

const opt = <T,>(v: T | undefined, k: string) => (v === undefined ? {} : { [k]: v });

export async function printPreset(artistId: string, sp: PresetParams, opts: { carryQueue?: boolean } = {}) {
  const preset: Record<string, Preset> = {};
  let note: string | null = null;
  const size = isSize(sp.size) ? (sp.size as SizeKey) : undefined;
  const copies = sp.copies ? Math.max(1, clampCopies(sp.copies, 1)) : undefined;

  if (opts.carryQueue) {
    const queued = await prisma.printQueueItem.findMany({ where: { artistId }, select: { artworkId: true, format: true, qty: true, qrCode: { select: { code: true, active: true } } }, orderBy: { createdAt: "asc" } }).catch(() => []);
    for (const q of queued) {
      if (!q.qrCode.active || preset[q.artworkId]) continue;
      preset[q.artworkId] = { code: q.qrCode.code, size: isSize(q.format) ? (q.format as SizeKey) : undefined, copies: Math.max(1, Math.min(100, q.qty)) };
    }
    if (queued.length) note = `Your print queue moved here. ${queued.length === 1 ? "Its code is" : `Its ${Object.keys(preset).length} pieces are`} ticked below, ready to print.`;
  }

  const list = (sp.pieces || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (list.length) {
    const where = list[0] === "all" ? { artistId, status: { in: ["APPROVED" as const, "PENDING" as const] }, slug: { not: null } } : { artistId, OR: [{ slug: { in: list } }, { id: { in: list } }] };
    const arts = await prisma.artwork.findMany({ where, select: { id: true } });
    for (const a of arts) preset[a.id] = { ...preset[a.id], ...opt(size, "size"), ...opt(copies, "copies") };
  }
  const codes = (sp.code || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 200);
  if (codes.length) {
    const found = await prisma.qrCode.findMany({ where: { artistId, code: { in: codes }, active: true, artworkId: { not: null } }, select: { code: true, artworkId: true } });
    for (const c of found) if (c.artworkId) preset[c.artworkId] = { ...preset[c.artworkId], code: c.code, ...opt(size, "size"), ...opt(copies, "copies") };
  }
  if (sp.place) {
    const r = await placeCodes(artistId, sp.place);
    if (r) {
      for (const c of r.codes) preset[c.artworkId] = { ...preset[c.artworkId], code: c.code, ...opt(size, "size"), ...opt(copies, "copies") };
      note = r.codes.length ? `Everything hanging at ${r.place.name} is ticked, with its code there.` : `Nothing is hanging at ${r.place.name} yet.`;
    }
  }
  return { preset, note };
}
