import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { adminRoleGuard } from "@/lib/adminRoles"
import { logAdminAction } from "@/lib/audit"
import { alertKey, resolveAlerts } from "@/lib/alerts"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, denied } = await adminRoleGuard("orders")
  if (denied) return denied

  try {
    const { sent } = await req.json()

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        sentToPrinter: Boolean(sent),
      },
    })

    if (sent) await resolveAlerts([alertKey.orderStuck(order.id), alertKey.workOrderFailed(order.id)])
    await logAdminAction(admin, sent ? "order.sent_to_printer" : "order.unsent_to_printer", { type: "order", id: order.id }, sent ? "Marked sent to printer" : "Unmarked sent to printer")
    return NextResponse.json(order)
  } catch (err) {
    console.error(err)
    return new NextResponse("Failed to update", { status: 500 })
  }
}