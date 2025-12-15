import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";


export async function GET(
  req: Request, 
  { params }: { params: { city: string } 
}) {
  const citySlug = (params.city || '').toLowerCase()
  const url = new URL(req.url)
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
  const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '12', 10))
  const skip = (page - 1) * limit

  const where = {
    status: "APPROVED",
    artist: { is: { citySlug: citySlug } } 
  }

  const total = await prisma.artwork.count({ where })
  const rows = await prisma.artwork.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
    include: { artist: { select: { name: true, slug: true, city: true } } },
  })

  const artworks = rows.map(a => ({
    id: a.id, 
    slug: a.slug!, 
    title: a.title, 
    imageUrl: a.imageUrl,
    markupSmall: a.markupSmall, markupMedium: a.markupMedium, markupLarge: a.markupLarge,
    artist: { 
      name: a.artist.name, 
      slug: a.artist.slug, 
      city: a.artist.city 
    }
  }))
  return NextResponse.json({ citySlug, total, artworks })
}