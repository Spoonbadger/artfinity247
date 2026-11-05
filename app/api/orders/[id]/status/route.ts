import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdmin } from "@/lib/admin"
import { logAdminAction } from "@/lib/audit"
import { cleanTracking, type Tracking } from "@/lib/tracking"
import { recordTracking } from "@/lib/shipping"
import { sendReviewRequest } from "@/lib/reviews"
import { sendShippingEmail } from "@/lib/orderEmails"

export const dynamic = "force-dynamic"
export const dynamicParams = true
export const runtime = "nodejs"


export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const input = await req.json().catch(() => ({}))
  const { shippingStatus } = input

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
          artwork: { select: { artistId: true } },
        },
      },
    },
  })

  if (!existing) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  // Marking shipped needs a carrier and tracking number; the buyer's email carries the link.
  let tracking: Tracking | null = null
  if (shippingStatus === "shipped" && existing.shippingStatus !== "shipped") {
    const t = cleanTracking(input)
    if ("error" in t) return NextResponse.json({ error: t.error }, { status: 400 })
    tracking = t.tracking
  }

  // Update status
  const order = await prisma.order.update({
    where: { id: params.id },
    data: {
      shippingStatus,
      ...(shippingStatus === "delivered" && !existing.deliveredAt ? { deliveredAt: new Date() } : {}),
    },
  })

  // Tracking goes on the order's columns (plus a Message per artist, which shows it in their customer thread),
  // and is registered with the carrier tracking provider so delivery is picked up automatically (lib/shipping).
  if (tracking) {
    await recordTracking(existing.id, tracking).catch((err) => console.error("Saving tracking failed", err))
  }

  // Only email on real transitions
  const was = existing.shippingStatus
  const now = shippingStatus

  if (was !== now || tracking) {
    await logAdminAction(admin, tracking ? "order.ship" : "order.shipping_status", { type: "order", id: order.id },
      tracking ? `Marked shipped: ${tracking.carrier} ${tracking.number}` : `Shipping ${was} → ${now}`,
      { from: was, to: now, tracking: tracking ?? undefined })
  }

  if (
    (was === "pending" && now === "shipped") ||
    (was === "shipped" && now === "delivered")
  ) {
    // The status change is saved; a failed email shouldn't make the admin UI report failure.
    await sendShippingEmail(order.id, now === "shipped" ? "shipped" : "delivered", tracking).catch((err) => console.error("Shipping status email failed", err))
  }

  // Delivered: ask the buyer for a review (lib/reviews.ts skips bulk orders and already-reviewed items).
  if (was !== "delivered" && now === "delivered") {
    await sendReviewRequest(order.id).catch((err) => console.error("Review request email failed", err))
  }

  return NextResponse.json({ ...order, tracking })
}