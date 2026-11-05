// POST /api/admin/orders/:id/work-order  "Resend work order" / "Retry" in admin orders (lib/printer.ts).
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { printerState, sendWorkOrder } from "@/lib/printer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const r = await sendWorkOrder(params.id, { force: true });
  await logAdminAction(admin, "order.work_order_resend", { type: "order", id: params.id },
    r.status === "sent" ? "Resent work order to the printer" : r.status === "failed" ? `Work order resend failed: ${r.error ?? ""}` : `Work order skipped: ${r.reason ?? ""}`,
    { status: r.status, ref: r.ref, error: r.error, reason: r.reason });
  const o = await prisma.order.findUnique({ where: { id: params.id }, select: { printerSentAt: true, printerRef: true, sentToPrinter: true } });
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const body = { ...r, printer: printerState(o), sentToPrinter: o.sentToPrinter };
  if (r.status === "failed") return NextResponse.json({ ...body, error: `Couldn't send: ${r.error}` }, { status: 502 });
  if (r.status === "skipped") return NextResponse.json({ ...body, error: r.reason }, { status: 409 });
  return NextResponse.json(body);
}
