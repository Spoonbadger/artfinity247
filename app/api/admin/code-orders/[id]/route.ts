// POST /api/admin/code-orders/:id — mailed QR code orders (lib/codePrints.ts). Every change is in the audit log.
//   { action: "printing" }                                          started printing
//   { action: "shipped", carrier, trackingNumber, trackingUrl? }    emails the artist the tracking link
//   { action: "delivered" }                                         emails the artist
//   { action: "refund_note", note }                                 records a refund made in Stripe (money role)
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { cleanTracking } from "@/lib/tracking";
import { setCodeOrderStatus } from "@/lib/codePrints";
import { codeOrderNumber, STATUS_LABEL } from "@/lib/printQueueFormat";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { admin, denied } = await adminRoleGuard(body.action === "refund_note" ? "money" : "orders");
  if (denied) return denied;
  const order = await prisma.codePrintOrder.findUnique({ where: { id: params.id } });
  if (!order) return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
  const no = codeOrderNumber(order.id);
  const target = { type: "code_order" as const, id: order.id };

  if (body.action === "refund_note") {
    const note = typeof body.note === "string" ? body.note.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 500) : "";
    if (!note) return NextResponse.json({ error: "Write what was refunded and why." }, { status: 400 });
    await prisma.codePrintOrder.update({ where: { id: order.id }, data: { refundNote: note, refundedAt: order.refundedAt ?? new Date() } });
    await logAdminAction(admin, "code_order.refund_note", target, `${no}: refund note`, { note, before: order.refundNote });
    return NextResponse.json({ ok: true });
  }

  if (order.status === "pending" || order.status === "canceled") return NextResponse.json({ error: "That order isn't paid, so there's nothing to print yet." }, { status: 409 });

  if (body.action === "printing" || body.action === "delivered") {
    await setCodeOrderStatus(order.id, body.action);
    await logAdminAction(admin, `code_order.${body.action}`, target, `${no}: ${STATUS_LABEL[body.action]}`, { from: order.status, to: body.action });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "shipped") {
    const t = cleanTracking({ carrier: body.carrier, trackingNumber: body.trackingNumber, trackingUrl: body.trackingUrl });
    if ("error" in t) return NextResponse.json({ error: t.error }, { status: 400 });
    await setCodeOrderStatus(order.id, "shipped", t.tracking);
    await logAdminAction(admin, "code_order.shipped", target, `${no}: shipped ${t.tracking.carrier} ${t.tracking.number}`, { from: order.status, tracking: t.tracking });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Pick an action." }, { status: 400 });
}
