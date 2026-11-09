import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles"
import { logAdminAction } from "@/lib/audit"
import { alertKey, resolveAlerts } from "@/lib/alerts"
import { sendReviewRequest } from "@/lib/reviews"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await adminRoleGuard("orders")
  if (denied) return denied

  const { status } = await req.json().catch(() => ({}))

  if (!["pending", "shipped", "delivered"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const exists = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true, shippingStatus: true } })
  if (!exists) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const order = await prisma.order.update({
    where: { id: params.id },
    data: { shippingStatus: status },
  })

  // Shipped or delivered: it reached the printer. Delivered: no longer "shipped, not delivered".
  if (status !== "pending") await resolveAlerts([alertKey.orderStuck(order.id), alertKey.workOrderFailed(order.id), ...(status === "delivered" ? [alertKey.orderUndelivered(order.id)] : [])])

  if (exists.shippingStatus !== status) {
    await logAdminAction(admin, "order.shipping_status", { type: "order", id: order.id }, `Shipping ${exists.shippingStatus} → ${status}`, { from: exists.shippingStatus, to: status })
  }

  // Delivered: ask the buyer for a review (lib/reviews.ts skips bulk orders and already-reviewed items).
  if (exists.shippingStatus !== "delivered" && status === "delivered") {
    await sendReviewRequest(order.id).catch((err) => console.error("Review request email failed", err))
  }

  return NextResponse.json(order)
}
