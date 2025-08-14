import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const page = Math.max(parseInt(req.nextUrl.searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "12", 10), 1), 48);
    const skip = (page - 1) * limit;

    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        slug: true,
        name: true,
        bio: true,
        city: true,
        state: true,
        country: true,
        profileImage: true,
      },
    });

    if (!artist) return new NextResponse("Artist not found", { status: 404 });

    const where = { artistId: artist.id };

    const [artworks, total] = await Promise.all([
      prisma.artwork.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          artist: { select: { name: true, slug: true } },
        },
      }),
      prisma.artwork.count({ where }),
    ]);

    return NextResponse.json({ artist, artworks, total }, { status: 200 });
  } catch (e) {
    console.error("GET /api/artists/[slug] failed", e);
    return new NextResponse("Server error", { status: 500 });
  }
}
