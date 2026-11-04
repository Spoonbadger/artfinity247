import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { prisma } from "@/lib/prisma"
import { calcItemProfitCents } from "@/lib/revenue"
import { normalizeSize } from "@/lib/sales"
import { sendOrderNotifications } from "@/lib/orderNotifications"

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

    const buyerEmail = (
      session.metadata?.buyerEmail ||
      session.customer_details?.email ||
      (typeof session.customer_email === "string" ? session.customer_email : "") ||
      ""
    ).trim().toLowerCase()

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

        const itemsToCreate = lineItems.data.map((li) => {
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
          const b = calcItemProfitCents({
            lineTotal,
            size: sizeNorm,
            frameChosen,
            quantity: qty,
            orderDate: order.createdAt,
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
          }
        })

        if (itemsToCreate.length > 0) {
          await prisma.orderItem.createMany({ data: itemsToCreate })
        }
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
    } catch (err) {
      console.error('❌ Error persisting order:', err)
      return new Response('Order processing failed', { status: 500 })
    }
  }

  return new Response(null, { status: 200 })
}
