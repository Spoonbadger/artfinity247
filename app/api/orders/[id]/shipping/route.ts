import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";
import { adminGuard } from "@/lib/admin"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await adminGuard()
  if (denied) return denied

  const { status } = await req.json().catch(() => ({}))

  if (!["pending", "shipped", "delivered"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const exists = await prisma.order.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: "Order not found" }, { status: 404 })

  const order = await prisma.order.update({
    where: { id: params.id },
    data: { shippingStatus: status },
  })

  return NextResponse.json(order)
}
