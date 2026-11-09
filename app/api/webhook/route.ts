import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { prisma } from "@/lib/prisma"
import { sendOrderNotifications } from "@/lib/orderNotifications"
import { sendWorkOrder } from "@/lib/printer"
import { artistIdsForOrder, followFromCheckout } from "@/lib/followers"
import { onOrderPaid } from "@/lib/collector"
import { markRewardUsed } from "@/lib/collectorRewards"
import { reportError } from "@/lib/monitor"
import { markScanPaid } from "@/lib/scanning.server"
import { markCodeOrderPaid } from "@/lib/codePrints"
import { shippingFrom } from "@/lib/checkoutSession"
import { recordCheckoutOrder, type BulkOrder } from "@/lib/checkoutOrder"

export const dynamic = "force-dynamic"
export const runtime = 'nodejs'

// Created lazily so the route can load (and reject bad requests) without Stripe keys, e.g. locally.
let stripeClient: Stripe | null = null
function getStripe() {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2025-08-27.basil',
    })
  }
  return stripeClient
}


export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig || !process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook error: missing signature or Stripe configuration', { status: 400 })
  }
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

  } catch (err) {
    console.error('Webhook error:', err)
    // A wrong STRIPE_WEBHOOK_SECRET after a deploy looks like this: worth a warning, not an alert.
    await reportError(err, { area: "webhook", name: "stripe-signature", level: "warning" })
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    console.log("EVENT TYPE:", event.type)

    const session = event.data.object as Stripe.Checkout.Session

    // Infinity subscriptions are not print orders: /api/webhook/billing handles them (lib/billing.ts).
    if (session.mode === 'subscription') return new Response(null, { status: 200 })

    // Painting scan bookings (/studio/scanning) are not print orders either: mark the booking paid (lib/scanning.server.ts).
    if (session.metadata?.kind === "scan") {
      if (session.payment_status === "paid" && session.metadata.scanBookingId) await markScanPaid(session.metadata.scanBookingId, session.id)
      return new Response(null, { status: 200 })
    }

    // Printed QR codes mailed to the artist (lib/codePrints.ts) are not print orders either: mark that order paid.
    if (session.metadata?.kind === "code_print" && session.metadata?.codePrintOrderId) {
      if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
        try {
          await markCodeOrderPaid(session.metadata.codePrintOrderId)
        } catch (err) {
          console.error("Code print order webhook failed", err)
          await reportError(err, { area: "webhook", name: "code-print-order" })
          return new Response("Code print order failed", { status: 500 })
        }
      }
      return new Response(null, { status: 200 })
    }

    const buyerEmail = (
      session.metadata?.buyerEmail ||
      session.customer_details?.email ||
      (typeof session.customer_email === "string" ? session.customer_email : "") ||
      ""
    ).trim().toLowerCase()

    // Bulk orders (an artist buying their own prints at cost, from /studio/bulk) carry their kind
    // and the artist's shipping address in metadata.
    const isBulk = session.metadata?.kind === "bulk" && !!session.metadata?.bulkArtistId
    const bulk: BulkOrder | null = isBulk
      ? { kind: "bulk", bulkArtistId: session.metadata!.bulkArtistId, shippingName: session.metadata?.shipName || null, shippingAddress: session.metadata?.shipAddress || null }
      : null

    try {
      const shipping = shippingFrom(session)
      // 1) Order, once per session, and 2) its items, once per order (lib/checkoutOrder.ts): retries add nothing.
      const order = await recordCheckoutOrder(prisma, session, {
        buyerEmail,
        bulk,
        // Line items with product expanded (so product.metadata is available)
        listLineItems: () => stripe.checkout.sessions.listLineItems(session.id, { expand: ['data.price.product'] }),
      })

      // Buyer ticked "Email me when … posts new work": a confirmed follow per artist (upsert, retry-safe).
      if (!isBulk && session.metadata?.follow === "1" && session.payment_status === "paid") {
        await followFromCheckout(buyerEmail, await artistIdsForOrder(order.id), shipping.name)
          .catch((e) => console.error("checkout follow failed", order.id, e))
      }

      // Collector accounts (optional): a redeemed reward is used up, the collection is "seen", and a new reward may be emailed.
      if (!isBulk && session.payment_status === "paid") {
        const rewardN = Number(session.metadata?.rewardN || 0)
        if (rewardN > 0 && buyerEmail) await markRewardUsed(buyerEmail, rewardN, order.id).catch((e) => console.error("reward not marked used", order.id, e))
        await onOrderPaid(order.id)
      }

      // 3) Emails: admin, each artist, buyer receipt. Each kind is sent at most
      //    once per order (tracked by adminNotificationSentAt /
      //    artistNotificationsSentAt / receiptSentAt), so Stripe retries are safe.
      if (order.adminNotificationSentAt && order.artistNotificationsSentAt && order.receiptSentAt) {
        console.log("Order already processed:", order.id)
      } else {
        const sent = await sendOrderNotifications(order.id)
        console.log("Order notifications", order.id, sent)
      }

      // 4) Work order to the print lab (lib/printer.ts). Sent once per order; never throws, so a lab
      //    problem never fails the webhook. Failures show in /admin/orders with a Retry button.
      if (session.payment_status === "paid") {
        const wo = await sendWorkOrder(order.id)
        if (wo.status === "failed") console.error("Work order not sent", order.id, wo.error)
      }
    } catch (err) {
      console.error('❌ Error persisting order:', err)
      await reportError(err, { area: "webhook", name: "stripe-checkout", extra: { eventId: event.id, sessionId: session.id }, adminAlert: true })
      return new Response('Order processing failed', { status: 500 })
    }
  }

  return new Response(null, { status: 200 })
}
