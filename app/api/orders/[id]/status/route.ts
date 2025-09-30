import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs"

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params
  const body = await req.json()
  const { shippingStatus } = body

  if (!["pending", "shipped", "delivered"].includes(shippingStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  await prisma.order.update({
    where: { id },
    data: { shippingStatus },
  })

  return NextResponse.json({ success: true })
}