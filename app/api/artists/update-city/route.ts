import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { jwtVerify } from 'jose'
import slugify from 'slugify'

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
  let { city } = await req.json()

  if (!city || typeof city !== 'string' || !city.trim() || city.length > 80) {
    return new NextResponse('City required', { status: 400 })
  }

  city = city.trim()
  const citySlug = slugify(city, { lower: true, strict: true })

  const artist = await prisma.artist.update({
    where: { id: payload.id as string },
    data: { city, citySlug },
    select: { city: true, citySlug: true },
  })

  return NextResponse.json({ artist })
}