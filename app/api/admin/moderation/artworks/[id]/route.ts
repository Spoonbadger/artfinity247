import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth"
import { Prisma } from "@prisma/client";
import { announceArtworkLive, resolveArtworkAlerts } from "@/lib/artworkLive";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin().catch(() => null);

    if (!admin) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const { id } = params;
    const body = await req.json();
    const action = body.action as "approve" | "reject";
    const reason = (body.reason as string | undefined) || null;

    if (!action || !["approve", "reject"].includes(action)) {
      return new NextResponse("Invalid action", { status: 400 });
    }

    const updateData =
      action === "approve"
        ? {
            status: "APPROVED" as const,
            flaggedReason: null,
            flaggedBy: null,
          }
        : {
            status: "REJECTED" as const,
            flaggedReason: reason || "rejected_by_admin",
            flaggedBy: admin.id,
          };

    const before = await prisma.artwork.findUnique({ where: { id }, select: { status: true, title: true, artistId: true, flaggedReason: true } });
    if (!before) return new NextResponse("Not found", { status: 404 });

    const artwork = await prisma.artwork.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        status: true,
        flaggedReason: true,
        flaggedBy: true,
      },
    });

    // Out of review: referral reward and the artist's "it's live" email.
    if (action === "approve" && before.status !== "APPROVED") await announceArtworkLive(artwork.id);
    await resolveArtworkAlerts([artwork.id]);
    await logAdminAction(admin, `artwork.${action}`, { type: "artwork", id }, `${action === "approve" ? "Approved" : "Rejected"} “${before.title}”`, {
      artistId: before.artistId, from: before.status, flaggedReason: before.flaggedReason, reason: action === "reject" ? updateData.flaggedReason : undefined,
    });

    return NextResponse.json(artwork, { status: 200 });
  } catch (err: any) {
    console.error("PATCH /api/admin/moderation/artworks/[id] error:", err);
    if (err?.status === 401 || err?.status === 403) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return new NextResponse("Server error", { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin();
    const { id } = params;
    const art = await prisma.artwork.findUnique({ where: { id }, select: { title: true, artistId: true, status: true } });

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Detach any order items so historical orders still exist
      await tx.orderItem.updateMany({
        where: { artworkId: id },
        data: { artworkId: null },
      });

      // TODO: if you want to free Cloudinary storage,
      // you need to store public_id on Artwork and call cloudinary.uploader.destroy() here.

      await tx.artwork.delete({
        where: { id },
      });
    });

    await resolveArtworkAlerts([id]);
    if (art) await logAdminAction(admin, "artwork.delete", { type: "artwork", id }, `Deleted “${art.title}”`, { artistId: art.artistId, status: art.status });
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error("DELETE /api/admin/moderation/artworks/[id] error:", err);
    if (err?.status === 401 || err?.status === 403) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return new NextResponse("Server error", { status: 500 });
  }
}