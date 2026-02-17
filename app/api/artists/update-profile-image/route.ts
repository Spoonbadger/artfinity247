import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jwtVerify } from "jose";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return new NextResponse("Unauthorized", { status: 401 });

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    const artistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;

    if (!artistId) return new NextResponse("Invalid token", { status: 401 });

    const { imageUrl } = await req.json();
    if (!imageUrl) return new NextResponse("Missing imageUrl", { status: 400 });

    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      data: { profileImage: imageUrl },
      select: { slug: true, profileImage: true },
    });

    return NextResponse.json({ artist });
  } catch (err) {
    console.error("Update profile image failed:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
