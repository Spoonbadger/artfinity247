import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { helpPath } from "@/lib/reprints";
import { certPathsFor } from "@/lib/certificates";
import Stripe from "stripe";

export const dynamic = "force-dynamic"
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ message: 'missing session_id' }, { status: 400 })

  // brief poll (webhook race)
  let order: any = null

  for (let i = 0; i < 6; i++) {
    order = await prisma.order.findUnique({
      where: { stripeSessionId: sessionId },
      select: {
        id: true,
        createdAt: true,
        email: true,
        amountTotal: true,
        currency: true,
        paymentStatus: true,
        receiptSentAt: true,
        shippingStatus: true,
        shippingName: true,
        shippingAddress: true,
        items: {
          select: {
            id: true, slug: true, size: true, quantity: true, unitPrice: true, lineTotal: true,
            title: true, imageUrl: true, frameChosen: true, frameColor: true, editionNumber: true,
            artwork: { 
              select: { 
                imageUrl: true, 
                title: true, 
                slug: true, 
                editionSize: true,
                artist: { 
                  select: { 
                    name: true, 
                    slug: true 
                  } 
                } 
              } 
            },
          }
        }
      },
    })
    if (order) break
    await new Promise(r => setTimeout(r, 500))
  }
  if (!order) return NextResponse.json({ message: 'Order not found', status: await missingStatus(sessionId) }, { status: 404 })

  // Holding the session id stands in for the buyer: once it ships, offer the signed "Problem with your print?" link.
  const shipped = order.shippingStatus === "shipped" || order.shippingStatus === "delivered"
  // Limited-edition lines: a signed link to the printable certificate of authenticity (lib/certificates.ts).
  const certs = order.paymentStatus === "paid" ? await certPathsFor(order.items.map((i: { id: string }) => i.id)) : new Map<string, string>()
  const items = order.items.map((i: { id: string }) => ({ ...i, certPath: certs.get(i.id) ?? null }))
  return NextResponse.json({ ...order, items, helpPath: shipped ? helpPath(order.id) : null })
}
/**
 * No order for this session yet: "pending" while the webhook is on its way, "failed" when the payment never went
 * through (the Stripe session expired or was never completed). Test checkout writes its order before the redirect,
 * so a dev_ session with no order is a failed one (that's also how to see the failure screen locally).
 */
async function missingStatus(sessionId: string): Promise<"pending" | "failed"> {
  if (sessionId.startsWith("dev_")) return "failed"
  if (!process.env.STRIPE_SECRET_KEY || !sessionId.startsWith("cs_")) return "pending"
  try {
    const s = await new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-08-27.basil" }).checkout.sessions.retrieve(sessionId)
    return s.status === "expired" || s.status === "open" ? "failed" : "pending"
  } catch {
    return "pending"
  }
}
