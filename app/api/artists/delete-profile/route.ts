import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser();
    const artistId = user.id;

    await prisma.$transaction(async (tx) => {
      // 1) Find this artist's artworks
      const artworks = await tx.artwork.findMany({
        where: { artistId },
        select: { id: true },
      });
      const artworkIds = artworks.map((a) => a.id);

      // 2) Detach OrderItems from those artworks (keep order history)
      if (artworkIds.length > 0) {
        await tx.orderItem.updateMany({
          where: { artworkId: { in: artworkIds } },
          data: { artworkId: null },
        });
      }

      // 3) Delete payouts for this artist
      await tx.payout.deleteMany({
        where: { artistId },
      });

      // 4) Delete artworks
      await tx.artwork.deleteMany({
        where: { artistId },
      });

      // 5) Finally delete the artist profile
      await tx.artist.delete({
        where: { id: artistId },
      });
    });

    // Clear auth cookie
    const res = new NextResponse(null, { status: 204 });
    res.cookies.set("auth-token", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return res;
  } catch (err: any) {
    console.error("Delete profile failed:", err);
    if (err?.status === 401) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return new NextResponse("Server error", { status: 500 });
  }
}