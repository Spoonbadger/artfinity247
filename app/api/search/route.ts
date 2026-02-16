import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

export const dynamic = "force-dynamic" // ??

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "10", 10)

    if (!q) {
      return NextResponse.json({ artworks: [], artists: [], total: 0 })
    }

    const skip = (page - 1) * limit

    // Search artworks
    const artworks = await prisma.artwork.findMany({
      where: { title: { contains: q, mode: "insensitive" } },
      select: { slug: true, title: true, imageUrl: true, artist: { select: { name: true, slug: true } } },
      skip,
      take: limit,
    })

    // Search artists
    const artists = await prisma.artist.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      select: { slug: true, name: true, profileImage: true },
      skip,
      take: limit,
    })

    // Count totals
    const [artworkCount, artistCount] = await Promise.all([
      prisma.artwork.count({ where: { title: { contains: q, mode: "insensitive" } } }),
      prisma.artist.count({ where: { name: { contains: q, mode: "insensitive" } } }),
    ])

    return NextResponse.json({
      artworks,
      artists,
      total: artworkCount + artistCount,
    })
  } catch (err) {
    console.error("Search API error", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
