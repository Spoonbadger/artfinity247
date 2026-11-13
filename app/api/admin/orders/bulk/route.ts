// POST /api/admin/orders/bulk { ids: string[], action: "sent" }  Mark many orders as sent to the printer.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { alertKey, resolveAlerts } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("orders");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: unknown };
  const ids = Array.from(new Set((Array.isArray(input.ids) ? input.ids : []).filter((x): x is string => typeof x === "string"))).slice(0, 200);
  if (input.action !== "sent") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Select some orders first." }, { status: 400 });

  const todo = await prisma.order.findMany({ where: { id: { in: ids }, sentToPrinter: false }, select: { id: true } });
  await prisma.order.updateMany({ where: { id: { in: todo.map((o) => o.id) } }, data: { sentToPrinter: true } });
  for (const o of todo) await logAdminAction(admin, "order.sent_to_printer", { type: "order", id: o.id }, "Marked sent to printer (bulk)", { bulk: true });
  await resolveAlerts(todo.flatMap((o) => [alertKey.orderStuck(o.id), alertKey.workOrderFailed(o.id)]));
  return NextResponse.json({ ok: true, updated: todo.map((o) => o.id) });
}
