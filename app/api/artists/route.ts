import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
  try {
    const page  = Math.max(parseInt(req.nextUrl.searchParams.get("page")  || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get("limit") || "12", 10), 1), 48);
    const skip  = (page - 1) * limit;

    const sort = req.nextUrl.searchParams.get("sort") || "name_az"

    let orderBy: any = {}

    if (sort === "name_az") {
      orderBy = { name: "asc" } // Maybe not name - capitilizaiton issue?
    } 
    else if (sort === "name_za") {
      orderBy = { name: "desc" };
    }
    else {
      orderBy = { createdAt: "desc" }
    }

    const [artists, total] = await Promise.all([
      prisma.artist.findMany({
        skip, take: limit,
        orderBy,
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