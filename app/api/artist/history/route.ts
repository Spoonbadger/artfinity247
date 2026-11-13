import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";

export const runtime = 'nodejs'
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    // Auth
    const user = await getUserFromCookie()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const artistId = user.id
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
