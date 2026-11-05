import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdmin } from "@/lib/admin"
import { logAdminAction } from "@/lib/audit"

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { sent } = await req.json()

    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        sentToPrinter: Boolean(sent),
      },
    })

    await logAdminAction(admin, sent ? "order.sent_to_printer" : "order.unsent_to_printer", { type: "order", id: order.id }, sent ? "Marked sent to printer" : "Unmarked sent to printer")
    return NextResponse.json(order)
  } catch (err) {
    console.error(err)
    return new NextResponse("Failed to update", { status: 500 })
  }
}