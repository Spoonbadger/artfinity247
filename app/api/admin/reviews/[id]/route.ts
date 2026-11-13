// PATCH /api/admin/reviews/:id { status: "published" | "hidden" }  ·  DELETE /api/admin/reviews/:id
// Admin moderation for buyer reviews. Publishing a held (flagged) review emails the artist, as a new review would have.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { notifyArtistOfReview } from "@/lib/reviews";
import { logAdminAction } from "@/lib/audit";
import { alertKey, resolveAlert } from "@/lib/alerts";

export const dynamic = "force-dynamic";

const guard = () => adminRoleGuard("reviews");

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await guard();
  if (denied) return denied;
  const { status } = await req.json().catch(() => ({}));
  if (status !== "published" && status !== "hidden") return NextResponse.json({ error: "Status must be published or hidden." }, { status: 400 });
  const was = await prisma.review.findUnique({ where: { id: params.id }, select: { status: true, artistId: true, rating: true, buyerName: true, orderItem: { select: { orderId: true } } } });
  if (!was) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  const review = await prisma.review.update({ where: { id: params.id }, data: { status }, select: { id: true, status: true } });
  await resolveAlert(alertKey.reviewFlagged(review.id));
  if (was.status === "flagged" && status === "published") {
    await notifyArtistOfReview(review.id).catch((err) => console.error("Review email to artist failed", err));
  }
  await logAdminAction(admin, status === "published" ? "review.publish" : "review.hide", { type: "review", id: review.id }, `${status === "published" ? "Published" : "Hid"} ${was.rating}★ review by ${was.buyerName}`, {
    artistId: was.artistId, orderId: was.orderItem.orderId, from: was.status,
  });
  return NextResponse.json({ ok: true, review });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await guard();
  if (denied) return denied;
  const was = await prisma.review.findUnique({ where: { id: params.id }, select: { artistId: true, rating: true, buyerName: true, body: true, orderItem: { select: { orderId: true } } } });
  const gone = await prisma.review.deleteMany({ where: { id: params.id } });
  if (!gone.count) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  await resolveAlert(alertKey.reviewFlagged(params.id));
  await logAdminAction(admin, "review.delete", { type: "review", id: params.id }, `Deleted ${was?.rating ?? "?"}★ review by ${was?.buyerName ?? "a buyer"}`, {
    artistId: was?.artistId, orderId: was?.orderItem.orderId, body: was?.body?.slice(0, 300),
  });
  return new NextResponse(null, { status: 204 });
}
