import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import slugify from 'slugify'

import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { user, denied } = await activeUserGuard() // signed in, session still valid, account not paused or closed
  if (denied) return denied
  let { city } = await req.json()

  if (!city || typeof city !== 'string' || !city.trim() || city.length > 80) {
    return NextResponse.json({ error: "Add your city.", code: "invalid_input" }, { status: 400 })
  }

  city = city.trim()
  const citySlug = slugify(city, { lower: true, strict: true })

  const artist = await prisma.artist.update({
    where: { id: user.id },
    data: { city, citySlug },
    select: { city: true, citySlug: true },
  })

  return NextResponse.json({ artist })
}