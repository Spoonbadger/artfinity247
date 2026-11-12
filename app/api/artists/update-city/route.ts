// POST /api/artists/update-city { city, state? }
// The public city on the artist's page. citySlug comes from the city and state (lib/citySlug.ts). The state is the
// one sent, or one typed on the end of the city ("Austin, TX"), or else the one already on the account.
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { citySlugFor, splitCityState, stateAbbr } from "@/lib/citySlug";

import { verifyAuthTokenOrThrow } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 })

  const payload = await verifyAuthTokenOrThrow(token); // signature, expiry and session version
  const body = await req.json()
  let { city } = body

  if (!city || typeof city !== 'string' || !city.trim() || city.length > 80) {
    return NextResponse.json({ error: "Add your city.", code: "invalid_input" }, { status: 400 })
  }

  city = city.trim()
  const sent = typeof body.state === 'string' ? stateAbbr(body.state) : null
  const picked = sent ?? splitCityState(city).state
  const current = picked ? null : await prisma.artist.findUnique({ where: { id: payload.id as string }, select: { state: true } })
  const state = picked ?? current?.state ?? null
  const citySlug = citySlugFor(city, state)

  const artist = await prisma.artist.update({
    where: { id: payload.id as string },
    data: { city, citySlug, ...(picked ? { state: picked } : {}) },
    select: { city: true, citySlug: true },
  })

  return NextResponse.json({ artist })
}
