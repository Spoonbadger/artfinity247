import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { adminGuard } from "@/lib/admin"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await adminGuard()
  if (denied) return denied

  try {
    const { sent } = await req.json()

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        sentToPrinter: Boolean(sent),
      },
    })

    return NextResponse.json(order)
  } catch (err) {
    console.error(err)
    return new NextResponse("Failed to update", { status: 500 })
  }
}