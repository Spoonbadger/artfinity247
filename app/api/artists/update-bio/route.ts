import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { jwtVerify } from "jose";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return new NextResponse("Not authenticated", { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    // you sign { id, email, slug }
    const artistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;
    if (!artistId) return new NextResponse("Invalid token", { status: 401 });

    const { bio } = await req.json();
    if (typeof bio !== "string") {
      return new NextResponse("Invalid bio", { status: 400 });
    }

    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      data: { bio },
      select: { slug: true, bio: true },
    });

    return NextResponse.json({ artist }, { status: 200 });
  } catch (err) {
    console.error("POST /api/artists/update-bio failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}