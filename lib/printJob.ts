// Print codes (/studio/print), server side. Server only.
//
// A print is a list of lines: a piece, which of its codes, a size and how many copies. Every line is checked here:
// - The code must be the artist's own, live, and for that piece. A piece with no code yet gets one plain code, made
//   once and reused on every later print (lib/shortlinks.ts ensureArtworkCode), so printing never piles up codes.
// - The card uses the code's saved QR Studio look, in the size picked, with the code's discount as it is NOW, so the
//   printed badge matches what a scan gives. Nothing about a waiting print is ever stored.
// - Free artists get the closest free look for Infinity extras (lib/generateQrPdf.ts prepareJob).
// Printing records each line once (lib/labelStatus.ts recordPrints + a QrPrintLog row), which drives "Printed Nov 5"
// in My codes and the out-of-date label check.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLACEHOLDER_CODE, ensureArtworkCode, shortUrl } from "@/lib/shortlinks";
import { DEFAULT_DESIGN, sanitizeDesign, type CustomSize, type Design } from "@/components/qr/card";
import { artInfoOf, queueArtSelect } from "@/lib/printQueue";
import { cardBox, clampCopies, isSize, lookInSize, MAX_LINES, type SizeKey } from "@/lib/printOptions";
import { markupsOf, recordPrints } from "@/lib/labelStatus";
import type { CardJob } from "@/lib/generateQrPdf";

export type PrintLineInput = { artworkId?: unknown; code?: unknown; size?: unknown; copies?: unknown };

const codeSelect = {
  id: true, code: true, label: true, venue: true, discountPct: true, design: true, createdAt: true, artworkId: true,
  place: { select: { name: true } },
} as const;

/** A look without venue, discount or end date: those live on the code record. */
const plain = (d: Design): Design => ({ ...d, disc: 0, coupon: "", ev: "", evPrint: false, end: "never" });

/** The code a piece prints with by default: the newest one designed in the QR Studio, else the newest one. */
function defaultCode<T extends { design: unknown; createdAt: Date }>(codes: T[]): T | null {
  return codes.find((c) => c.design != null) ?? codes[0] ?? null;
}

/** The look a code prints with: its saved Studio look, else the artist's newest saved look, else the default. */
async function baseLook(artistId: string, design: unknown, cache: { last?: Design }): Promise<Design> {
  if (design != null) return sanitizeDesign(design);
  if (!cache.last) {
    const c = await prisma.qrCode.findFirst({ where: { artistId, design: { not: Prisma.DbNull } }, orderBy: { createdAt: "desc" }, select: { design: true } });
    cache.last = plain(c?.design ? sanitizeDesign(c.design) : DEFAULT_DESIGN);
  }
  return cache.last;
}

/** Everything the Print codes screen lists for one artist: their pieces, each with its live codes and card looks. */
export async function printablePieces(artistId: string, base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com") {
  const [arts, last, fallback] = await Promise.all([
    prisma.artwork.findMany({
      where: { artistId, status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } },
      select: { ...queueArtSelect, qrCodes: { where: { active: true }, select: codeSelect, orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    }),
    // The size each piece was last printed in, so it comes back the same way.
    prisma.codePrint.findMany({ where: { artistId }, orderBy: { printedAt: "desc" }, select: { artworkId: true, format: true }, take: 500 }),
    // The look for codes never designed, and for pieces with no code yet.
    baseLook(artistId, null, {}),
  ]);
  const lastSize = new Map<string, string>();
  for (const p of last) if (p.artworkId && !lastSize.has(p.artworkId)) lastSize.set(p.artworkId, p.format);
  const codeOut = (c: (typeof arts)[number]["qrCodes"][number]) => {
    const d = c.design != null ? sanitizeDesign(c.design) : null;
    return { code: c.code, name: c.label || c.place?.name || c.venue || null, discountPct: c.discountPct ?? 0, custom: d?.custom ?? null, format: d?.format ?? null, designed: c.design != null, look: d ?? fallback, qrText: shortUrl(c.code, base) };
  };
  return {
    pieces: arts.map((a) => {
      const def = defaultCode(a.qrCodes);
      const sized = lastSize.get(a.id);
      return {
        id: a.id, slug: a.slug as string, title: a.title, imageUrl: a.imageUrl, inReview: a.status === "PENDING",
        art: artInfoOf(a),
        // A piece with no code yet previews with a same-length stand-in; its real code is made when it prints.
        look: fallback,
        sampleQr: shortUrl(PLACEHOLDER_CODE, base),
        codes: a.qrCodes.map(codeOut),
        defaultCode: def?.code ?? null,
        // Last printed size, else the default code's own format, else a wall label.
        size: (isSize(sized) ? sized : def?.design ? sanitizeDesign(def.design).format : "label") as SizeKey,
      };
    }),
  };
}

export type PrintablePieces = Awaited<ReturnType<typeof printablePieces>>;

export type ResolvedLine = {
  job: CardJob;
  copies: number;
  size: SizeKey;
  custom: CustomSize | null;
  qrCodeId: string;
  code: string;
  artworkId: string;
  art: { title: string; markups: ReturnType<typeof markupsOf> };
};

export class PrintError extends Error {
  constructor(message: string, public code: string, public status = 400) { super(message); }
}

/**
 * Checks and fills in a print's lines for `artistId`. Lines with 0 copies are skipped. Throws PrintError with a
 * message people can act on. base: the public URL codes point at.
 */
export async function resolveLines(artistId: string, input: unknown, base: string): Promise<ResolvedLine[]> {
  const raw = (Array.isArray(input) ? input : []) as PrintLineInput[];
  const lines = raw
    .map((l) => ({ artworkId: typeof l?.artworkId === "string" ? l.artworkId : "", code: typeof l?.code === "string" ? l.code.toUpperCase() : null, size: l?.size, copies: clampCopies(l?.copies, 0) }))
    .filter((l) => l.copies > 0);
  if (!lines.length) throw new PrintError("Pick at least one piece to print.", "nothing_to_print");
  if (lines.length > MAX_LINES) throw new PrintError(`One print takes up to ${MAX_LINES} pieces. Print the rest next.`, "too_many");
  if (lines.some((l) => !l.artworkId || !isSize(l.size))) throw new PrintError("Something in the list didn't look right. Reload and try again.", "bad_request");

  const ids = Array.from(new Set(lines.map((l) => l.artworkId)));
  const arts = await prisma.artwork.findMany({
    where: { id: { in: ids }, artistId, status: { in: ["APPROVED", "PENDING"] }, slug: { not: null } },
    select: { ...queueArtSelect, qrCodes: { where: { active: true }, select: codeSelect, orderBy: { createdAt: "desc" } } },
  });
  const byId = new Map(arts.map((a) => [a.id, a]));
  const cache: { last?: Design } = {};
  const out: ResolvedLine[] = [];
  for (const l of lines) {
    const a = byId.get(l.artworkId);
    if (!a) throw new PrintError("One of these pieces isn't yours, or is no longer live. Reload and try again.", "not_found", 404);
    let qr = l.code ? a.qrCodes.find((c) => c.code === l.code) ?? null : defaultCode(a.qrCodes);
    if (l.code && !qr) throw new PrintError(`Code ${l.code} is paused or isn't for “${a.title}”. Pick another code.`, "code_off");
    if (!qr) {
      // First print of this piece: one plain code, reused from now on.
      const code = await ensureArtworkCode(artistId, a.id, a.title);
      qr = await prisma.qrCode.findUnique({ where: { code }, select: codeSelect });
      if (!qr) throw new PrintError("Couldn't make a code for this piece. Try again.", "server_error", 500);
      a.qrCodes.unshift(qr);
    }
    const look = await baseLook(artistId, qr.design, cache);
    const sized = lookInSize(look, l.size as SizeKey);
    if (!sized) throw new PrintError(`“${a.title}” has no custom size saved. Pick a size, or set one in the QR Studio.`, "no_custom");
    if (!cardBox(l.size as SizeKey, sized.custom)) throw new PrintError("That size isn't available.", "bad_request");
    // Today's discount on today's code, never an old one.
    const design: Design = { ...sized, disc: qr.discountPct ?? 0 };
    out.push({
      job: { design, art: artInfoOf(a), qrText: shortUrl(qr.code, base) },
      copies: l.copies,
      size: l.size as SizeKey,
      custom: sized.custom,
      qrCodeId: qr.id,
      code: qr.code,
      artworkId: a.id,
      art: { title: a.title, markups: markupsOf(a) },
    });
  }
  return out;
}

/** Records a home print: once per line (My codes "Printed Nov 5", the out-of-date label check). Never throws. */
export async function recordHomePrint(artistId: string, lines: ResolvedLine[]) {
  try {
    await prisma.qrPrintLog.createMany({ data: lines.map((l) => ({ qrCodeId: l.qrCodeId, artistId, format: l.job.design.format, qty: l.copies, method: "home" })) });
  } catch (e) {
    console.error("[print] print log failed", e);
  }
  await recordPrints(lines.map((l) => ({ qrCodeId: l.qrCodeId, artistId, artworkId: l.artworkId, design: l.job.design, art: l.art, qty: l.copies, source: "download" as const })));
}
