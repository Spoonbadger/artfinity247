import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin"
import { sendReviewRequest } from "@/lib/reviews"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await adminGuard()
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

  // Delivered: ask the buyer for a review (lib/reviews.ts skips bulk orders and already-reviewed items).
  if (exists.shippingStatus !== "delivered" && status === "delivered") {
    await sendReviewRequest(order.id).catch((err) => console.error("Review request email failed", err))
  }

  return NextResponse.json(order)
}
