import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { sceneImagePath, DEFAULT_SCENE_IMG } from '@/lib/sceneImages'

export async function GET() {
  // artists who have at least one artwork
  const rows = await prisma.artist.findMany({
    where: { artworks: { some: {} } },
    select: {
      city: true,
      citySlug: true,
      _count: { select: { artworks: true } },
    },
    orderBy: { city: 'asc' },
  })

  const scenes = rows.map(r => ({
    _id: r.citySlug,           // keep your existing CollectionType shape
    title: r.city,
    slug: r.citySlug,
    count: r._count.artworks,  // optional: show on card if you want
    img: sceneImagePath(r.citySlug),
  }))

  return NextResponse.json({ scenes, total: scenes.length })
}
