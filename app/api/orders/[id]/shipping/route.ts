import { NextRequest, NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

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
