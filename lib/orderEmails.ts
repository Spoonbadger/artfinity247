// Buyer emails for an order's shipping steps, and resending them from the admin. Server only.
import { prisma } from "@/lib/prisma"
import { resend } from "@/lib/resend"
import ShippingStatusEmail from "@/emails/ShippingStatusEmail"
import { sendArtistOrderEmail, sendArtistReceipt } from "@/lib/artistEmails.server"
import { sendReceiptEmail } from "@/lib/email"
import { trackingText, type Tracking } from "@/lib/tracking"
import { getTracking } from "@/lib/shipping/store"
import { helpLine, helpUrl } from "@/lib/reprints"
import { certLines, certLinksFor } from "@/lib/certificates"

/** Latest tracking saved on the order (the tracking columns, else the older Message), or null. */
export async function latestTracking(orderId: string): Promise<Tracking | null> {
  return getTracking(orderId)
}

/**
 * The shipped or delivered email: the artist's own wording when they wrote one, else Artfinity's default.
 * Under the artist's words: tracking (when shipping), certificates and the signed "Problem with your print?" link.
 */
export async function sendShippingEmail(orderId: string, status: "shipped" | "delivered", tracking: Tracking | null) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, email: true, shippingName: true,
      items: { select: { title: true, size: true, quantity: true, imageUrl: true } },
    },
  })
  if (!order) throw new Error("Order not found")
  const certificates = status === "shipped" ? await certLinksFor(order.id).catch(() => []) : []
  const append = [tracking ? trackingText(tracking) : "", certLines(certificates), helpLine(order.id)].filter(Boolean).join("\n\n")
  const sentByArtist = await sendArtistOrderEmail(order.id, status, { append }).catch((err) => {
    console.error("Artist shipping email failed, sending default", err)
    return false
  })
  if (sentByArtist) return "artist" as const
  const { error } = await resend.emails.send({
    from: "Artfinity <notifications@theartfinity.com>",
    to: order.email || "",
    subject: status === "shipped" ? "Your Artfinity order has shipped!" : "Your Artfinity order was delivered!",
    react: ShippingStatusEmail({
      name: order.shippingName || "Customer",
      status,
      orderId: order.id,
      items: order.items.map((i) => ({ title: i.title ?? "Untitled", size: i.size ?? "", quantity: i.quantity ?? 1, imageUrl: i.imageUrl ?? null })),
      tracking,
      helpUrl: helpUrl(order.id),
      certificates,
    }),
  })
  if (error) throw error
  return "default" as const
}

/** Sends the receipt again (the artist's wording when they have one). Keeps the original receipt time if nothing went out. */
export async function resendReceipt(orderId: string): Promise<"sent" | "skipped"> {
  const o = await prisma.order.findUnique({ where: { id: orderId }, select: { receiptSentAt: true, kind: true } })
  if (!o) throw new Error("Order not found")
  await prisma.order.update({ where: { id: orderId }, data: { receiptSentAt: null } })
  try {
    const mine = o.kind === "bulk" ? "none" : await sendArtistReceipt(orderId)
    if (mine === "sent") return "sent"
    const r = (await sendReceiptEmail(orderId)) as { skipped?: boolean } | undefined
    if (r?.skipped) return "skipped"
    await prisma.order.updateMany({ where: { id: orderId, receiptSentAt: null }, data: { receiptSentAt: new Date() } })
    return "sent"
  } finally {
    // Nothing went out (no email key in dev): put the original time back.
    await prisma.order.updateMany({ where: { id: orderId, receiptSentAt: null }, data: { receiptSentAt: o.receiptSentAt } })
  }
}
