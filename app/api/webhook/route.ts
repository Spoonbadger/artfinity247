import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { PrismaClient } from '@prisma/client'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-06-30.basil'
})

const prisma = new PrismaClient()

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
        console.error('Webhook error: ', err)
        return new Response(`Webhook error: ${(err as Error).message}`, { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session

        console.log('Payment received 💰: ', session.id)

        try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id)

            for (const item of lineItems.data) {
                const productMeta = item.price?.product as string

                const product = await stripe.products.retrieve(productMeta)

                await prisma.order.create({
                    data: {
                        stripeSessionId: session.id,
                        email: session.customer_details?.email ?? '',
                        amountTotal: item.amount_total ?? 0,
                        currency: session.currency ?? '',
                        paymentStatus: session.payment_status ?? '',
                        artworkId: product.metadata?.artworkId ?? '',
                        size: product.metadata?.size ?? '', 
                        slug: product.metadata?.slug ?? '',
                        unitPrice: item.price?.unit_amount ?? 0,
                        quantity: item.quantity ?? 1,
                    }
                })
            }

            console.log('Order(s) saved for session:', session.id)
        } catch (err) {
            console.error('Error saving Order:', err)
        }
    }

    return new Response(null, { status: 200 })
}
