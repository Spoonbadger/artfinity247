import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { prisma } from "@/lib/prisma"
import { artistSplitsForOrder, calcItemProfitCents } from "@/lib/revenue"
import { normalizeSize } from "@/lib/sales"
import { sendOrderNotifications } from "@/lib/orderNotifications"
import { sendWorkOrder } from "@/lib/printer"
import { claimEditionNumbers } from "@/lib/editions"
import { artistIdsForOrder, followFromCheckout } from "@/lib/followers"
import { onOrderPaid } from "@/lib/collector"
import { markRewardUsed, preservedSplit } from "@/lib/collectorRewards"
import { reportError } from "@/lib/monitor"
import { markScanPaid } from "@/lib/scanning.server"
import { markCodeOrderPaid } from "@/lib/codePrints"

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

    const session = event.data.object as Stripe.Checkout.Session & {
      shipping_details?: {
        name?: string
        address?: {
          line1?: string
          city?: string
          state?: string
          postal_code?: string
          country?: string
        }
      }
    }

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
    const bulk = isBulk
      ? { kind: "bulk", bulkArtistId: session.metadata!.bulkArtistId, shippingName: session.metadata?.shipName || null, shippingAddress: session.metadata?.shipAddress || null }
      : null

    try {
      const shipping = session.shipping_details
      // 1) Idempotent order create (upsert by unique stripeSessionId)
      const order = await prisma.order.upsert({
        where: { stripeSessionId: session.id },
        update: {
          // Don’t touch totals on retry, but update shipping/email if missing
          email: buyerEmail,
          paymentStatus: session.payment_status ?? '',

          shippingName: shipping?.name ?? null,

          shippingAddress: shipping?.address
            ? `${shipping.address.line1 ?? ''}, ${shipping.address.city ?? ''}, ${shipping.address.state ?? ''} ${shipping.address.postal_code ?? ''}, ${shipping.address.country ?? ''}`
            : null,
          ...(bulk ?? {}),
        },
        create: {
          stripeSessionId: session.id,
          email: buyerEmail,
          amountTotal: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          paymentStatus: session.payment_status ?? '',
          shippingName: shipping?.name ?? null,
          shippingAddress: shipping?.address
            ? `${shipping.address.line1 ?? ''}, ${shipping.address.city ?? ''}, ${shipping.address.state ?? ''} ${shipping.address.postal_code ?? ''}, ${shipping.address.country ?? ''}`
            : null,
          ...(bulk ?? {}),
        },
      })

      const existingItems = await prisma.orderItem.count({
        where: { orderId: order.id },
      })

      // 2) Create items once (a retry finds them already there)
      if (existingItems === 0) {
        // Line items with product expanded (so product.metadata is available)
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ['data.price.product'],
        })

        // Lock in each artist's split (Free 60%, Infinity higher) as of this order. Bulk orders pay no split.
        const splits = isBulk
          ? lineItems.data.map(() => null)
          : await artistSplitsForOrder(prisma, lineItems.data.map((li) => ({
              artistId: (li.price?.product as Stripe.Product | null)?.metadata?.artistId || null,
              quantity: li.quantity ?? 1,
            })), order.createdAt)

        const itemsToCreate = lineItems.data.map((li, idx) => {
          const product = li.price?.product as Stripe.Product | null
          const unit = li.price?.unit_amount ?? 0
          const qty = li.quantity ?? 1
          const rawSize = product?.metadata?.size || 'medium'

          const sizeNorm = normalizeSize(rawSize)
          const lineTotal = unit * qty

          const frameChosen = product?.metadata?.frameChosen === "true"
          const rawFrameColor = product?.metadata?.frameColor || ""
          const frameColor =
            frameChosen && ["black", "white", "natural"].includes(rawFrameColor)
              ? rawFrameColor
              : null
          // Collector reward (lib/collectorRewards.ts): keep the artist's share at the pre-reward price.
          const rewardFrom = Number(product?.metadata?.rewardFromUnit || 0)
          const split = rewardFrom > unit && splits[idx] != null
            ? preservedSplit({ preRewardLineTotal: rewardFrom * qty, lineTotal, size: sizeNorm, frameChosen, quantity: qty, orderDate: order.createdAt, split: splits[idx]! })
            : splits[idx]
          const b = calcItemProfitCents({
            lineTotal,
            size: sizeNorm,
            frameChosen,
            quantity: qty,
            orderDate: order.createdAt,
            artistSplit: split,
          })

          return {
            orderId: order.id,
            artworkId: product?.metadata?.artworkId ?? null,
            slug: product?.metadata?.slug || '',
            size: sizeNorm,
            frameChosen,
            frameColor,
            unitPrice: unit,
            quantity: qty,
            lineTotal,
            title: product?.metadata?.title || li.description || null,
            artistName: product?.metadata?.artistName || null,
            imageUrl: product?.metadata?.imageUrl || null,

            printCost: b.printCost,
            shippingCost: b.shippingCost,
            laborCost: b.laborCost,
            websiteCost: b.websiteCost,
            artistSplit: split,
            // Short link code the sale came through (checked at checkout, carried in metadata)
            qrCodeId: product?.metadata?.qrCodeId || null,
          }
        })

        if (itemsToCreate.length > 0) {
          // Limited editions: number the prints inside one transaction that locks each artwork.
          // Stripe already took the money, so a line that no longer fits (two checkouts racing for
          // the last prints) is still recorded, without a number, and logged for a refund.
          await prisma.$transaction(async (tx) => {
            const { numbers, shortfalls } = await claimEditionNumbers(tx, itemsToCreate.map((it) => ({ artworkId: it.artworkId, quantity: it.quantity })))
            if (shortfalls.length) console.error("EDITION OVERSOLD: refund needed", { orderId: order.id, shortfalls })
            await tx.orderItem.createMany({ data: itemsToCreate.map((it, i) => ({ ...it, editionNumber: numbers[i] })) })
          })
        }
      }

      // Buyer ticked "Email me when … posts new work": a confirmed follow per artist (upsert, retry-safe).
      if (!isBulk && session.metadata?.follow === "1" && session.payment_status === "paid") {
        await followFromCheckout(buyerEmail, await artistIdsForOrder(order.id), shipping?.name)
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
