// POST /api/studio/print-queue/printed { format } → "Mark as printed": logs each code in that format as printed today
// (My codes shows "Printed Nov 5") and clears them from the queue. → { cleared, cards }
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isFormat, queueCount } from "@/lib/printQueue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { format?: unknown };
  if (!isFormat(body.format)) return NextResponse.json({ error: "Pick a format.", code: "bad_request" }, { status: 400 });
  const rows = await prisma.printQueueItem.findMany({ where: { artistId: user.id, format: body.format }, select: { id: true, qrCodeId: true, qty: true, format: true } });
  if (!rows.length) return NextResponse.json({ error: "Nothing in that group to mark. It may already be cleared.", code: "queue_empty" }, { status: 404 });
  try {
    await prisma.$transaction([
      prisma.qrPrintLog.createMany({ data: rows.map((r) => ({ qrCodeId: r.qrCodeId, artistId: user.id, format: r.format, qty: r.qty, method: "home" })) }),
      prisma.printQueueItem.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } }),
    ]);
    return NextResponse.json({ cleared: rows.reduce((n, r) => n + r.qty, 0), codes: rows.length, cards: await queueCount(user.id) });
  } catch (e) {
    console.error("[print-queue] mark printed failed", e);
    return NextResponse.json({ error: "Couldn't mark them as printed. Try again.", code: "server_error" }, { status: 500 });
  }
}
