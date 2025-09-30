import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
  try {
    const page  = Math.max(parseInt(req.nextUrl.searchParams.get("page")  || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "12", 10), 1), 48);
    const skip  = (page - 1) * limit;

    const [artists, total] = await Promise.all([
      prisma.artist.findMany({
        skip, take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, slug: true, name: true, bio: true,
          profileImage: true, city: true, state: true, country: true,
        },
      }),
      prisma.artist.count(),
    ]);

    return NextResponse.json({ artists, total }, { status: 200 });
  } catch (e) {
    console.error("GET /api/artists failed", e);
    return new NextResponse("Server error", { status: 500 });
  }
}