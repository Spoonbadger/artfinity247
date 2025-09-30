import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { jwtVerify } from 'jose'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    // Auth
    const token = req.cookies.get('auth-token')?.value
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    const artistId = payload.id as string
    if (!artistId) return NextResponse.json({ error: 'No artist ID' }, { status: 400 })

    // Fetch payout history
    const payouts = await prisma.payout.findMany({
        where: { artistId },
        orderBy: { month: 'desc' },
        select: {
            month: true,
            amountCents: true,
            paidAt: true,
            createdAt: true,
        },
    })


    return NextResponse.json({ payouts })
  } catch (err) {
    console.error('Payout history error', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
