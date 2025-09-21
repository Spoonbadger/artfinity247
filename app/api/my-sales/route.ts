import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify } from 'jose'

export const runtime = "nodejs"
const prisma = new PrismaClient()

async function getUserFromCookie(req: NextRequest) {
    const token = req.cookies.get("auth-token")?.value
    if (!token) return null
    
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET)
      const { payload } = await jwtVerify(token, secret)
      console.log("JWT payload:", payload)
      return payload as { id?: string, slug?: string, email?: string }
    } catch {
        return null
    }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie(req)
  if (!user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  // All items for artworks owned by this artist, newest first
  const items = await prisma.orderItem.findMany({
    where: { artwork: { artistId: user.id } },
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