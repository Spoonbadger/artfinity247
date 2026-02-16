import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 48);
    const skip = (page - 1) * limit;
    const sort = searchParams.get("sort") || "newest";

    let artworks, total

    if (sort === "random") {
      // raw SQL for random ordering
      artworks = await prisma.$queryRawUnsafe(`
        SELECT a.*, ar."name" as "artistName", ar."slug" as "artistSlug"
        FROM "Artwork" a
        LEFT JOIN "Artist" ar ON a."artistId" = ar."id"
        ORDER BY RANDOM()
        LIMIT ${limit} OFFSET ${skip}
      `)

      total = await prisma.artwork.count()
    } else {
      let orderBy: any = { createdAt: "desc" } // default newest
      if (sort === "oldest") orderBy = { createdAt: "asc" };
      if (sort === "popular") {
      // TODO: replace with real sales count
      orderBy = { createdAt: "desc" }
    }

      [artworks, total] = await Promise.all([
        prisma.artwork.findMany({
          skip,
          where: { status: "APPROVED" },
          take: limit,
          orderBy,
          include: { artist: { select: { name: true, slug: true } } },
        }),
        prisma.artwork.count(),
      ]);
    }

    return NextResponse.json({ artworks, total }, { status: 200 });
  } catch (err) {
    console.error("api Error fetching all arts: ", err);
    return new NextResponse('Server Error', { status: 500 });
  }
}