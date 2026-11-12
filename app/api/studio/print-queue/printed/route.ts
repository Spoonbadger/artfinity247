// POST /api/studio/print-queue/printed { format } → "Mark as printed": logs each code in that format as printed today
// (My codes shows "Printed Nov 5") and clears them from the queue. → { cleared, cards }
import { NextRequest, NextResponse } from "next/server";
import { activeUserGuard } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFormat, queueCount } from "@/lib/printQueue";
import { markupsOf, recordPrints } from "@/lib/labelStatus";
import { assignCodes } from "@/lib/artistPlaces";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, denied } = await activeUserGuard("Log in to keep going.");
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { format?: unknown };
  if (!isFormat(body.format)) return NextResponse.json({ error: "Pick a format.", code: "bad_request" }, { status: 400 });
  const rows = await prisma.printQueueItem.findMany({
    where: { artistId: user.id, format: body.format },
    select: { id: true, qrCodeId: true, qty: true, format: true, design: true, artworkId: true, placeId: true, artwork: { select: { title: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true } }, place: { select: { id: true, name: true, venueId: true } } },
  });
  if (!rows.length) return NextResponse.json({ error: "Nothing in that group to mark. It may already be cleared.", code: "queue_empty" }, { status: 404 });
  try {
    await prisma.$transaction([
      prisma.qrPrintLog.createMany({ data: rows.map((r) => ({ qrCodeId: r.qrCodeId, artistId: user.id, format: r.format, qty: r.qty, method: "home" })) }),
      prisma.printQueueItem.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
    ]);
    // What each printed card says (lib/labelStatus.ts). Printed for a Place: the code now hangs there.
    await recordPrints(rows.map((r) => ({ qrCodeId: r.qrCodeId, artistId: user.id, artworkId: r.artworkId, design: { ...(r.design as object), format: r.format }, art: { title: r.artwork.title, markups: markupsOf(r.artwork) }, qty: r.qty, source: "queue" as const, ...(r.placeId ? { placeId: r.placeId } : {}) })));
    for (const r of rows) if (r.place) await assignCodes(user.id, [r.qrCodeId], r.place);
    return NextResponse.json({ cleared: rows.reduce((n, r) => n + r.qty, 0), codes: rows.length, cards: await queueCount(user.id) });
  } catch (e) {
    console.error("[print-queue] mark printed failed", e);
    return NextResponse.json({ error: "Couldn't mark them as printed. Try again.", code: "server_error" }, { status: 500 });
  }
}
