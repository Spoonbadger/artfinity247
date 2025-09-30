import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";


export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { status } = await req.json()

  if (!["pending", "shipped", "delivered"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  const order = await prisma.order.update({
    where: { id: params.id },
    data: { shippingStatus: status },
  })

  return NextResponse.json(order)
}
