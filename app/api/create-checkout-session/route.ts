import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})

function abs(url?: string | null) {
  if (!url) return undefined
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  const base = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  return url.startsWith('/') ? base + url : `${base}/${url}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const items = Array.isArray(body.items) ? body.items : []

    const line_items = items.map((item: any) => {
      // Accept either flat shape or { product, quantity }
      const p = item.product ?? item
      const quantity = Number(item.quantity ?? p.quantity ?? 1)
      const title = p.title ?? 'Artwork'
      const image = p.image ?? p.imageUrl
      const unit_amount = Number(p.unitPrice ?? 0) // cents

      // normalize optional metadata fields
      const selectedSize = p.selectedSize ?? p.seletedSize ?? ''
      const slug = p.slug ?? ''
      const artworkId = p.artworkId ?? slug

      return {
        price_data: {
          currency: 'usd',
          product_data: {
            name: title,
            images: image ? [abs(image)!] : [],
            metadata: {
              selectedSize,
              slug,
              artworkId,
            },
          },
          unit_amount,
        },
        quantity,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
      }
    })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      // if you want Stripe to collect shipping:
      // shipping_address_collection: { allowed_countries: ['US','GB','CA','AU','IE','DE','FR','ES','IT','NL','SE','NO','DK','FI','BE','AT','CH'] },
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/cart`,
      locale: 'en',
      metadata: {
        // optional order-level metadata
      },
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return new Response(
      JSON.stringify({ error: 'Stripe session creation failed' }),
      { status: 500 }
    )
  }
}