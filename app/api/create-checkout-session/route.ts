import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-06-30.basil",
})

export async function POST(req: Request) {
    try {
        const body = await req.json()

        const items = body.items

        const line_items = items.map((item: any) => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.title,
                    images: item.image ? [item.image] : []
                },
                unit_amount: item.price,
            },
            quantity: item.quantity
        }))

        // Create Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items,
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cancel`,
            locale: 'en'
        })

        //ToDo Validate items, create session, return sessionId


        return new Response(JSON.stringify({ sessionId: session.id }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (err) {
        console.error('Stripe error: ', err)
        return new Response(JSON.stringify({ error: 'Stripe session creation failed' }), {
            status: 500,
        })
    }
}