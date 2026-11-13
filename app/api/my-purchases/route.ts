import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { verifyAuthToken } from '@/lib/auth'

export const dynamic = "force-dynamic"
export const runtime = 'nodejs'

async function getUserFromCookie(req: NextRequest) {
    const token = req.cookies.get("auth-token")?.value
    if (!token) return null

    // Signature, expiry and session version.
    return verifyAuthToken(token)
}

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie(req)
  if (!user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }


  const items = await prisma.orderItem.findMany({
    where: {
      order: {
        email: {
          equals: user.email,
          mode: "insensitive", // Postgres: case-insensitive compare
        },
      },
    },
    select: {
      id: true,
      slug: true,
      size: true,
      quantity: true,
      unitPrice: true,
      lineTotal: true,
      title: true,
      artistName: true,
      imageUrl: true,
      order: {
        select: {
          id: true,
          createdAt: true,
          email: true,
          paymentStatus: true,
          currency: true,
        },
      },
    },
    orderBy: [{ order: { createdAt: "desc" } }],
  })


  return NextResponse.json(items)
}