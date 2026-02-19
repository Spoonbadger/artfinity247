import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [artworks, artists, scenes] = await Promise.all([
      prisma.artwork.count(),
      prisma.artist.count(),
      prisma.artist.findMany({
        distinct: ["city"],
        select: { city: true },
      }),
    ]);

    return NextResponse.json({
      artworks,
      artists,
      scenes: scenes.length,
    });
  } catch (err) {
    console.error("Stats fetch failed", err);
    return new NextResponse("Server Error", { status: 500 });
  }
}