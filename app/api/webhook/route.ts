import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-06-30.basil'
})

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

        // ToDo add DB logic here
    }

    return new Response(null, { status: 200 })
}