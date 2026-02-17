import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireAdmin();

    const artworks = await prisma.artwork.findMany({
      where: {
        OR: [
          { status: "PENDING" },
          { status: "REJECTED" },
          { flaggedReason: { not: null } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        createdAt: true,
        status: true,
        flaggedReason: true,
        flaggedBy: true,
        artist: {
          select: {
            id: true,
            slug: true,
            artist_name: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ artworks }, { status: 200 });
  } catch (err: any) {
    if (err?.status === 401) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (err?.status === 403) {
      return new NextResponse("Forbidden", { status: 403 });
    }
    console.error("GET /api/admin/moderation/artworks error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}