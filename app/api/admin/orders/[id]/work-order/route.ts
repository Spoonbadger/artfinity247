// POST /api/admin/orders/:id/work-order  "Resend work order" / "Retry" in admin orders (lib/printer.ts).
import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { printerState, sendWorkOrder } from "@/lib/printer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const r = await sendWorkOrder(params.id, { force: true });
  const o = await prisma.order.findUnique({ where: { id: params.id }, select: { printerSentAt: true, printerRef: true, sentToPrinter: true } });
  if (!o) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const body = { ...r, printer: printerState(o), sentToPrinter: o.sentToPrinter };
  if (r.status === "failed") return NextResponse.json({ ...body, error: `Couldn't send: ${r.error}` }, { status: 502 });
  if (r.status === "skipped") return NextResponse.json({ ...body, error: r.reason }, { status: 409 });
  return NextResponse.json(body);
}
