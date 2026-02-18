import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"
import { ArtworkStatus } from "@prisma/client";


export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const page = Math.max(parseInt(req.nextUrl.searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "12", 10), 1), 48);
    const skip = (page - 1) * limit;
    const sort = req.nextUrl.searchParams.get("sort") || "latest"

    const artist = await prisma.artist.findUnique({
      where: { slug: params.slug },
      select: {
        id: true,
        slug: true,
        artist_name: true,
        first_name: true,
        last_name: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        bio: true,
        city: true,
        state: true,
        country: true,
        profileImage: true,
        venmoHandle: true,
      },
    })

    if (!artist) return new NextResponse("Artist not found", { status: 404 });

    const where = { artistId: artist.id, status: ArtworkStatus.APPROVED };


    let orderBy: any = { createdAt: "desc" };

    if (sort === "latest") {
      orderBy = { createdAt: "desc" };
    }

    if (sort === "oldest") {
      orderBy = { createdAt: "asc" };
    }

    if (sort === "az") {
      orderBy = { title: "asc" };
    }

    if (sort === "za") {
      orderBy = { title: "desc" };
    }


    const [artworks, total] = await Promise.all([
      prisma.artwork.findMany({
        where,
        orderBy,
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

    return NextResponse.json({ artist, artworks, total }, { status: 200 })
  } catch (e) {
    console.error("GET /api/artists/[slug] failed", e)
    return new NextResponse("Server error", { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const body = await req.json()
    let { venmoHandle } = body

    if (!venmoHandle || typeof venmoHandle !== "string") {
      return NextResponse.json({ error: "Invalid venmoHandle" }, { status: 400 })
    }

    if (!venmoHandle.startsWith("@")) {
      venmoHandle = "@" + venmoHandle
    }

    venmoHandle = venmoHandle.replace(/\s+/g, "")

    // Only letters, numbers, underscores, dashes after "@"
    if (!/^@[A-Za-z0-9_-]+$/.test(venmoHandle)) {
      return NextResponse.json(
        { error: "Venmo handle can only contain letters, numbers, dashes and underscores" },
        { status: 400 }
      )
    }

    const artist = await prisma.artist.update({
      where: { slug: params.slug },
      data: { venmoHandle },
      select: {
        id: true,
        slug: true,
        name: true,
        venmoHandle: true,
      },
    })

    return NextResponse.json(artist)
  } catch (err: any) {
    if (err.code === "P2002") {
      return NextResponse.json({ error: "That Venmo handle is already in use." }, { status: 400 })
    }
    console.error("Error updating venmoHandle:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}