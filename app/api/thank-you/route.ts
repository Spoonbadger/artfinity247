import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { helpPath } from "@/lib/reprints";

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
  if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 })

  // Holding the session id stands in for the buyer: once it ships, offer the signed "Problem with your print?" link.
  const shipped = order.shippingStatus === "shipped" || order.shippingStatus === "delivered"
  return NextResponse.json({ ...order, helpPath: shipped ? helpPath(order.id) : null })
}