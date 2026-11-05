import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10", 10) || 10, 1), 48)

    if (!q) {
      return NextResponse.json({ artworks: [], artists: [], total: 0 })
    }

    const skip = (page - 1) * limit

    // Search artworks (approved only: pending/rejected work is never public)
    const artworkWhere = { status: "APPROVED" as const, artist: { closedAt: null, suspendedAt: null }, title: { contains: q, mode: "insensitive" as const } }
    const artworks = await prisma.artwork.findMany({
      where: artworkWhere,
      select: { slug: true, title: true, imageUrl: true, artist: { select: { name: true, slug: true } } },
      skip,
      take: limit,
    })

    // Search artists
    const artists = await prisma.artist.findMany({
      where: { name: { contains: q, mode: "insensitive" }, closedAt: null, suspendedAt: null },
      select: { slug: true, name: true, profileImage: true },
      skip,
      take: limit,
    })

    // Count totals
    const [artworkCount, artistCount] = await Promise.all([
      prisma.artwork.count({ where: artworkWhere }),
      prisma.artist.count({ where: { name: { contains: q, mode: "insensitive" }, closedAt: null, suspendedAt: null } }),
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
