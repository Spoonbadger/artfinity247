// One print queue item.
//   PATCH { qty }        new quantity (1 to 500)
//   PATCH { preset }     change look: one of the QR Studio starting looks; keeps the code, venue and discount.
//                        A look in another format moves it to that group (merging with the same code there).
//   DELETE               remove it
import { NextRequest, NextResponse } from "next/server";
import { activeUserGuard } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { presetLook, sanitizeDesign } from "@/components/qr/card";
import { clampQty, isPreset, queueCount } from "@/lib/printQueue";
import { QUEUE_MAX_QTY } from "@/lib/printQueueFormat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const err = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

async function own(id: string) {
  const { user, denied } = await activeUserGuard("Log in to change your print queue."); // signed in, not paused or closed
  if (denied) return { denied, user: null, item: null };
  const item = await prisma.printQueueItem.findFirst({ where: { id, artistId: user.id } });
  return { denied: null, user, item };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { denied, user, item } = await own(params.id);
  if (denied) return denied;
  if (!item) return err("That code isn't in your queue any more.", "queue_item_gone", 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  try {
    if ("qty" in body) {
      const qty = clampQty(body.qty, item.qty);
      await prisma.printQueueItem.update({ where: { id: item.id }, data: { qty } });
      return NextResponse.json({ ok: true, qty, cards: await queueCount(user.id) });
    }
    if (isPreset(body.preset)) {
      const d = sanitizeDesign(item.design);
      const next = { ...d, ...presetLook(body.preset), preset: body.preset, extras: [], season: "" as const, custom: null };
      const other = next.format !== item.format
        ? await prisma.printQueueItem.findUnique({ where: { artistId_qrCodeId_format: { artistId: user.id, qrCodeId: item.qrCodeId, format: next.format } } })
        : null;
      if (other) {
        await prisma.$transaction([
          prisma.printQueueItem.update({ where: { id: other.id }, data: { design: next as object, qty: Math.min(QUEUE_MAX_QTY, other.qty + item.qty) } }),
          prisma.printQueueItem.delete({ where: { id: item.id } }),
        ]);
      } else {
        await prisma.printQueueItem.update({ where: { id: item.id }, data: { design: next as object, format: next.format } });
      }
      return NextResponse.json({ ok: true, format: next.format, cards: await queueCount(user.id) });
    }
    return err("Nothing to change.", "bad_request", 400);
  } catch (e) {
    console.error("[print-queue] update failed", e);
    return err("Couldn't change that. Try again.", "server_error", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { denied, user, item } = await own(params.id);
  if (denied) return denied;
  if (!item) return NextResponse.json({ ok: true, cards: await queueCount(user.id) }); // already gone: same result
  await prisma.printQueueItem.delete({ where: { id: item.id } }).catch(() => null);
  return NextResponse.json({ ok: true, cards: await queueCount(user.id) });
}
