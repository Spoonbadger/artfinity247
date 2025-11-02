import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { prisma } from "@/lib/prisma";
import { sendReceiptEmail } from "@/lib/email"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})
export const runtime = 'nodejs'

const COSTS = {
  labor: 300,   // $3.00
  website: 100, // $1.00
  print: {
    small: 300,   // $3.00
    medium: 600,  // $6.00
    large: 1000,  // $10.00
  },
  shipping: {
    small: 500,   // $5.00
    medium: 700,  // $7.00
    large: 1000,  // $10.00
  },
} as const


export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )

    console.log("Incoming webhook: ", event.type)

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    console.log('Payment received 💰:', session.id)

    try {
      // 1) Idempotent order create (upsert by unique stripeSessionId)
      const order = await prisma.order.upsert({
        where: { stripeSessionId: session.id },
        update: {
          // don’t touch totals on retry, but update shipping/email if missing
          email: session.customer_details?.email ?? '',
          paymentStatus: session.payment_status ?? '',
          shippingName: session.customer_details?.name ?? null,
          shippingAddress: session.customer_details?.address
            ? `${session.customer_details.address.line1 ?? ''}, ${session.customer_details.address.city ?? ''}, ${session.customer_details.address.state ?? ''} ${session.customer_details.address.postal_code ?? ''}, ${session.customer_details.address.country ?? ''}`
            : null,
        },
        create: {
          stripeSessionId: session.id,
          email: session.customer_details?.email ?? '',
          amountTotal: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          paymentStatus: session.payment_status ?? '',
          shippingName: session.customer_details?.name ?? null,
          shippingAddress: session.customer_details?.address
            ? `${session.customer_details.address.line1 ?? ''}, ${session.customer_details.address.city ?? ''}, ${session.customer_details.address.state ?? ''} ${session.customer_details.address.postal_code ?? ''}, ${session.customer_details.address.country ?? ''}`
            : null,
        },
      })

      // 2) Get line items with product expanded (so product.metadata is available)
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'],
      })

      // 3) Map each line item → OrderItem
      const itemsToCreate = lineItems.data.map((li) => {
        const product = li.price?.product as Stripe.Product | null
        const unit = li.price?.unit_amount ?? 0
        const qty = li.quantity ?? 1
        const size = product?.metadata?.size || 'medium'

        return {
          orderId: order.id,
          artworkId: product?.metadata?.artworkId ?? null,
          slug: product?.metadata?.slug || '',
          size,
          unitPrice: unit,                 // cents
          quantity: qty,
          lineTotal: unit * qty,           // convenience
          title: product?.metadata?.title || li.description || null,
          artistName: product?.metadata?.artistName || null,
          imageUrl: product?.metadata?.imageUrl || null,
          printCost: COSTS.print[size as keyof typeof COSTS.print] ?? 0,
          shippingCost: COSTS.shipping[size as keyof typeof COSTS.shipping] ?? 0,
          laborCost: COSTS.labor,
          websiteCost: COSTS.website,
        }
      })

      // Optional: skip if we already created items (handles webhook retries)
      // If you want strict idempotency, you could check if items exist for this order.
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } })

      if (itemsToCreate.length > 0) {
        console.log("itemsToCreate:", itemsToCreate)
        await prisma.orderItem.createMany({ data: itemsToCreate })
      }
      console.log(`✅ Saved order ${order.id} with ${itemsToCreate.length} items`)

      // Send receipt (idempotent inside helper via receiptSentAt)
      try {
        await sendReceiptEmail(order.id)
        console.log("📧 Receipt email queued/sent")
      } catch (e) {
        console.error("Email send failed (non-blocking):", e)
      }

    } catch (err) {
      console.error('❌ Error persisting order:', err)
      // Still return 200 so Stripe doesn’t hammer retries forever
    }
  }

  return new Response(null, { status: 200 })
}
