import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
        return new Response('missing session_id', { status: 400 })
    }

    const order = await prisma.order.findUnique({
        where: { stripeSessionId: sessionId},
        select: { id: true, createdAt: true },
    })

    if (!order) {
        return new Response('Order not found', { status: 404 })
    }

    return Response.json(order)
}