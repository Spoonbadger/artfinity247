import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { sceneImagePath } from '@/lib/sceneImages'

export async function GET() {
  // artists who have at least one artwork and a non-empty citySlug
  const rows = await prisma.artist.findMany({
    where: {
      citySlug: { not: "" },
      artworks: { some: {} },
    },
    select: {
      city: true,
      citySlug: true,
      _count: { select: { artworks: true } },
    },
    orderBy: { city: 'asc' },
  })

  // Group by citySlug so each scene appears only once
  const byCitySlug = new Map<string, { city: string; citySlug: string; count: number }>()

  for (const r of rows) {
    const key = r.citySlug
    const existing = byCitySlug.get(key)

    if (existing) {
      // add this artist’s artworks to the city’s total
      existing.count += r._count.artworks
    } else {
      byCitySlug.set(key, {
        city: r.city,
        citySlug: r.citySlug,
        count: r._count.artworks,
      })
    }
  }

  const scenes = Array.from(byCitySlug.values()).map((r) => ({
    _id: r.citySlug,
    title: r.city,
    slug: r.citySlug,
    count: r.count,
    img: sceneImagePath(r.citySlug),
  }))

  return NextResponse.json({ scenes, total: scenes.length })
}