import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify } from 'jose'
import slugify from 'slugify'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!))
  const { city } = await req.json()

  if (!city || typeof city !== 'string') {
    return new NextResponse('City required', { status: 400 })
  }

  const citySlug = slugify(city, { lower: true, strict: true })

  const artist = await prisma.artist.update({
    where: { id: payload.id as string },
    data: { city, citySlug },
    select: { city: true, citySlug: true },
  })

  return NextResponse.json({ artist })
}