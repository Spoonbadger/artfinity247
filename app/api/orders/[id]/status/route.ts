import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { Resend } from "resend"
import ShippingStatusEmail from "@/emails/ShippingStatusEmail"

export const runtime = "nodejs"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { shippingStatus } = await req.json()

  if (!["pending", "shipped", "delivered"].includes(shippingStatus)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 })
  }

  // Get existing order WITH items
  const existing = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      items: {
        select: {
          title: true,
          size: true,
          quantity: true,
          imageUrl: true,
        },
      },
    },
  })

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Update status
  const order = await prisma.order.update({
    where: { id: params.id },
    data: { shippingStatus },
  })

  // Only email on real transitions
  const was = existing.shippingStatus
  const now = shippingStatus

  if (
    (was === "pending" && now === "shipped") ||
    (was === "shipped" && now === "delivered")
  ) {
    await resend.emails.send({
      from: "Artfinity <notifications@theartfinity.com>",
      to: order.email || "",
      subject:
        now === "shipped"
          ? "Your Artfinity order has shipped!"
          : "Your Artfinity order was delivered!",
      react: ShippingStatusEmail({
        name: existing.shippingName || "Customer",
        status: now,
        orderId: order.id,
        items: existing.items.map(i => ({
          title: i.title ?? "Untitled",
          size: i.size ?? "",
          quantity: i.quantity ?? 1,
          imageUrl: i.imageUrl ?? null,
        })),
      }),
    })
  }

  return NextResponse.json(order)
}