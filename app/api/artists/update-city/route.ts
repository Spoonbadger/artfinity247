import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import slugify from 'slugify'

import { verifyAuthTokenOrThrow } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 })

  const payload = await verifyAuthTokenOrThrow(token); // signature, expiry and session version
  let { city } = await req.json()

  if (!city || typeof city !== 'string' || !city.trim() || city.length > 80) {
    return NextResponse.json({ error: "Add your city.", code: "invalid_input" }, { status: 400 })
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