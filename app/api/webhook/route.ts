import { NextRequest } from 'next/server'
import { Stripe } from 'stripe'
import { prisma } from "@/lib/prisma"
import { sendReceiptEmail } from "@/lib/email"
import { Resend } from "resend"
import NewSaleNotificationEmail from "@/emails/NewSaleNotificationEmail"
import ArtistSaleNotificationEmail from "@/emails/ArtistSaleNotificationEmail"
import { calcItemProfitCents, type PrintSize } from "@/lib/revenue"


const resend = new Resend(process.env.RESEND_API_KEY)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})
export const runtime = 'nodejs'

function normalizeSize(raw: string | null): PrintSize {
  const v = (raw || "").toUpperCase();
  if (v.startsWith("S")) return "S";
  if (v.startsWith("L")) return "L";
  return "M"
}


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

      // 2) Get line items with product expanded (so product.metadata is available)
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'],
      })

      // 3) Map each line item → OrderItem
      const itemsToCreate = lineItems.data.map((li) => {
        const product = li.price?.product as Stripe.Product | null
        const unit = li.price?.unit_amount ?? 0
        const qty = li.quantity ?? 1
        const rawSize = product?.metadata?.size || 'medium'

        const sizeNorm = normalizeSize(rawSize)
        const lineTotal = unit * qty
        const b = calcItemProfitCents({ lineTotal, size: sizeNorm })

        return {
          orderId: order.id,
          artworkId: product?.metadata?.artworkId ?? null,
          slug: product?.metadata?.slug || '',
          size: sizeNorm,
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

      // For want strict idempotency, you could check if items exist for this order.
      await prisma.orderItem.deleteMany({ where: { orderId: order.id } })

      if (itemsToCreate.length > 0) {
        await prisma.orderItem.createMany({ data: itemsToCreate })
      }

      try {
        const rawItems = await prisma.orderItem.findMany({
          where: { orderId: order.id },
          select: {
            title: true,
            size: true,
            quantity: true,
            unitPrice: true,
          },
        })

        const items = rawItems.map(i => ({
          title: i.title ?? "",
          size: i.size ?? "",
          quantity: i.quantity ?? 1,
          unitPrice: i.unitPrice ?? 0,
        }))
console.log("SENDING ADMIN EMAIL")
        await resend.emails.send({
          from: "Artfinity <notifications@theartfinity.com>",
          to: "craig@theartfinity.com",
          subject: `New Sale – $${((order.amountTotal ?? 0)/100).toFixed(2)}`,
          react: NewSaleNotificationEmail({
            orderId: order.id,
            buyerEmail: order.email,
            totalCents: order.amountTotal ?? 0,
            items,
          }),
        })
      } catch (err) {
        console.error("Admin sale email failed", err)
      }
      await sleep(350)

      // Get items with artist IDs
      const soldItems = await prisma.orderItem.findMany({
        where: { orderId: order.id },
        include: {
          artwork: {
            include: {
              artist: true,
            },
          },
        },
      })

      // Group by artist (important if multi-artist order later)
      const byArtist = new Map()

      for (const item of soldItems) {
        const artist = item.artwork?.artist
        if (!artist) continue

        if (!byArtist.has(artist.id)) {
          byArtist.set(artist.id, {
            artist,
            items: [],
          })
        }

        byArtist.get(artist.id).items.push({
          title: item.title ?? "",
          size: item.size ?? "",
          quantity: item.quantity ?? 1,
          lineTotal: item.lineTotal ?? 0,
        })
      }

      // Send one email per artist
      for (const { artist, items } of byArtist.values()) {
        try {

console.log("SENDING ARTIST EMAIL")
          await resend.emails.send({
            from: "Artfinity <notifications@theartfinity.com>",
            to: artist.email,
            subject: "Your artwork sold on Artfinity!",
            react: ArtistSaleNotificationEmail({
              artistName: artist.artist_name ?? "Artist",
              items,
              totalCents: items.reduce((sum: number, i: any) => sum + i.lineTotal, 0),
            }),
          })
        } catch (err) {
          console.error("Artist sale email failed", err)
        }
      }
      await sleep(350)

      // Send receipt (idempotent inside helper via receiptSentAt)
      try {
console.log("SENDING RECEIPT")
        await sendReceiptEmail(order.id)
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
