import Stripe from 'stripe'
import { PrismaClient } from '@prisma/client'

export const runtime = 'nodejs'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
})
const prisma = new PrismaClient()

// TODO: move to AppConfigs.json (prices in cents)
const BASE = { small: 2499, medium: 3999, large: 5999 } as const
type Size = keyof typeof BASE

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

    // Build line_items from authoritative DB values (ignore client price/title)
    const line_items = (
      await Promise.all(
        items.map(async (item: any) => {
          const p = item.product ?? item
          const slug: string = String(p.slug ?? '').trim()
          const size: Size = String(p.selectedSize ?? '').toLowerCase() as any
          if (!slug || !['small', 'medium', 'large'].includes(size)) return null

          // Fetch artwork + artist for pricing & metadata
          const art = await prisma.artwork.findUnique({
            where: { slug },
            select: {
              id: true,
              slug: true,
              title: true,
              imageUrl: true,
              artistId: true,
              markupSmall: true,
              markupMedium: true,
              markupLarge: true,
              artist: { select: { name: true } },
            },
          })
          if (!art) return null

          const markup =
            size === 'small' ? (art.markupSmall ?? 0) :
            size === 'medium' ? (art.markupMedium ?? 0) :
            (art.markupLarge ?? 0)

          const unit_amount = BASE[size] + markup
          const quantity = Math.max(1, Math.min(10, Number(item.quantity ?? p.quantity ?? 1)))

          return {
            quantity,
            adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
            price_data: {
              currency: 'usd',
              unit_amount,
              product_data: {
                name: art.title,
                images: art.imageUrl ? [abs(art.imageUrl)!] : [],
                metadata: {
                  artworkId: art.id,
                  slug: art.slug || '',
                  size,
                  title: art.title,
                  artistName: art.artist?.name ?? '',
                  imageUrl: art.imageUrl ?? '',
                  artistId: art.artistId,
                },
              },
            },
          } as Stripe.Checkout.SessionCreateParams.LineItem
        })
      )
    ).filter(Boolean) as Stripe.Checkout.SessionCreateParams.LineItem[]

    if (!line_items.length) {
      return new Response(JSON.stringify({ error: 'No valid items' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      success_url: `${baseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cart`,
      locale: 'en',
      shipping_address_collection: { allowed_countries: ['US'] },   // add more when needed
      phone_number_collection: { enabled: true },
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: 'Standard',
            fixed_amount: { amount: 399, currency: 'usd' }, // Shipping initially set to $3.99
            type: 'fixed_amount',
          },
        },
      ],
    })

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Stripe error:', err)
    return new Response(JSON.stringify({ error: 'Stripe session creation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
