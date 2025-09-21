import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
export const runtime = 'nodejs'
const prisma = new PrismaClient()

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
        shippingName: true,
        shippingAddress: true,
        items: {
          select: {
            id: true, slug: true, size: true, quantity: true, unitPrice: true, lineTotal: true,
            artwork: { 
              select: { 
                imageUrl: true, 
                title: true, 
                slug: true, 
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

  return NextResponse.json(order)
}