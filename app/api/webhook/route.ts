import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { PrismaClient } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})
const prisma = new PrismaClient()
export const runtime = 'nodejs'


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
        update: {}, // no updates on retry
        create: {
          stripeSessionId: session.id,
          email: session.customer_details?.email ?? '',
          amountTotal: session.amount_total ?? 0,
          currency: session.currency ?? '',
          paymentStatus: session.payment_status ?? '',
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

        return {
          orderId: order.id,
          artworkId: product?.metadata?.artworkId || '',
          slug: product?.metadata?.slug || '',
          size: product?.metadata?.size || '',
          unitPrice: unit,                 // cents
          quantity: qty,
          lineTotal: unit * qty,           // convenience
        }
      })

      // Optional: skip if we already created items (handles webhook retries)
      // If you want strict idempotency, you could check if items exist for this order.
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } })

      if (itemsToCreate.length > 0) {
        await prisma.orderItem.createMany({ data: itemsToCreate })
      }

      console.log(`✅ Saved order ${order.id} with ${itemsToCreate.length} items`)
    } catch (err) {
      console.error('❌ Error persisting order:', err)
      // Still return 200 so Stripe doesn’t hammer retries forever
    }
  }

  return new Response(null, { status: 200 })
}
