import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { adminGuard } from "@/lib/admin"
import { resend } from "@/lib/resend"
import ShippingStatusEmail from "@/emails/ShippingStatusEmail"
import { sendArtistOrderEmail } from "@/lib/artistEmails.server"
import { sendReviewRequest } from "@/lib/reviews"

export const dynamic = "force-dynamic"
export const dynamicParams = true
export const runtime = "nodejs"


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const denied = await adminGuard()
  if (denied) return denied

  const { shippingStatus } = await req.json().catch(() => ({}))

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
    // The status change is saved; a failed email shouldn't make the admin UI report failure.
    try {
      // The artist's own wording when they wrote one; otherwise Artfinity's default below.
      const sentByArtist = await sendArtistOrderEmail(order.id, now === "shipped" ? "shipped" : "delivered").catch((err) => {
        console.error("Artist shipping email failed, sending default", err)
        return false
      })
      if (!sentByArtist) await resend.emails.send({
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
    } catch (err) {
      console.error("Shipping status email failed", err)
    }
  }

  // Delivered: ask the buyer for a review (lib/reviews.ts skips bulk orders and already-reviewed items).
  if (was !== "delivered" && now === "delivered") {
    await sendReviewRequest(order.id).catch((err) => console.error("Review request email failed", err))
  }

  return NextResponse.json(order)
}