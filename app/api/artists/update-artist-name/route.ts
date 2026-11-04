import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { jwtVerify } from "jose"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return new NextResponse("Not authenticated", { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )

    const artistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;
    if (!artistId) return new NextResponse("Invalid token", { status: 401 });

    const { name } = await req.json();
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
      return new NextResponse("Invalid name", { status: 400 });
    }

    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      // artist_name is what public pages show; name is the legacy copy. The slug (@handle) stays put.
      data: { name: name.trim(), artist_name: name.trim() },
      select: { slug: true, name: true, artist_name: true },
    });

    return NextResponse.json({ artist }, { status: 200 });
  } catch (err) {
    console.error("POST /api/artists/update-name failed", err);
    return new NextResponse("Server error", { status: 500 });
  }
}