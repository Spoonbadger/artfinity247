// POST /api/studio/print { lines: [{ artworkId, code?, size, copies }], paper, customPaper?, color?, artistId? } → the PDF.
// color: "color" (the default) or "bw".
// Print codes (/studio/print): any mix of pieces, sizes and copies, packed onto as few sheets of the chosen paper as
// fit (lib/printPack.ts). The download counts as printed (lib/printJob.ts recordHomePrint). artistId: an admin
// printing for that artist (lib/printAccess.ts).
import { NextRequest, NextResponse } from "next/server";
import { generatePackedPdf } from "@/lib/generateQrPdf";
import { artistIsPro } from "@/lib/qr/plan";
import { printAccess } from "@/lib/printAccess";
import { PrintError, recordHomePrint, resolveLines } from "@/lib/printJob";
import { isLabelSheet, isPaper, isPrintColor, paperName, paperSize } from "@/lib/printOptions";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { baseUrl, pdfHeaders } from "../../qr/art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const err = (error: string, code: string, status = 400) => NextResponse.json({ error, code }, { status });

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return err("Something went wrong. Reload and try again.", "bad_request");
  const who = await printAccess(body.artistId);
  if (who.denied) return who.denied;
  const paperKey = isPaper(body.paper) ? body.paper : "letter";
  const paper = paperSize(paperKey, body.customPaper as never);
  const name = paperName(paperKey, body.customPaper as never);
  try {
    const lines = await resolveLines(who.artistId, body.lines, baseUrl(req));
    const out = await generatePackedPdf(lines, paper, { color: isPrintColor(body.color) ? body.color : "color", pro: await artistIsPro(who.artistId), title: `${who.artistName ? `${who.artistName} · ` : ""}Artfinity QR codes`, paperName: name });
    if (out.unplaced) {
      return err(isLabelSheet(paperKey)
        ? `${out.unplaced} ${out.unplaced === 1 ? "card doesn't" : "cards don't"} match the labels on ${name}. Change their size, or print on plain paper.`
        : `${out.unplaced} ${out.unplaced === 1 ? "card is" : "cards are"} bigger than ${name}. Pick bigger paper or a smaller size.`, "doesnt_fit");
    }
    await recordHomePrint(who.artistId, lines);
    // Anything left in the old print queue was carried onto this screen; the first print retires it.
    if (!who.admin) await prisma.printQueueItem.deleteMany({ where: { artistId: who.artistId } }).catch(() => null);
    if (who.admin) {
      await logAdminAction(who.admin, "codes.print", { type: "artist", id: who.artistId }, `Printed ${out.cards} QR ${out.cards === 1 ? "card" : "cards"} for ${who.artistName || "an artist"}`, { lines: lines.map((l) => ({ artworkId: l.artworkId, qrCodeId: l.qrCodeId, size: l.size, copies: l.copies })), paper: paperKey });
    }
    return new NextResponse(Buffer.from(out.pdf), {
      status: 200,
      headers: { ...pdfHeaders(`artfinity-codes-${new Date().toISOString().slice(0, 10)}.pdf`), "X-Af-Sheets": String(out.sheets), "X-Af-Cards": String(out.cards) },
    });
  } catch (e) {
    if (e instanceof PrintError) return err(e.message, e.code, e.status);
    console.error("[print] pdf failed", e);
    return err("Couldn't make the PDF. Try again.", "server_error", 500);
  }
}
