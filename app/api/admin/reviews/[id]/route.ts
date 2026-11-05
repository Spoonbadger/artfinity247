// PATCH /api/admin/reviews/:id { status: "published" | "hidden" }  ·  DELETE /api/admin/reviews/:id
// Admin moderation for buyer reviews. Publishing a held (flagged) review emails the artist, as a new review would have.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notifyArtistOfReview } from "@/lib/reviews";

export const dynamic = "force-dynamic";

async function guard() {
  try {
    await requireAdmin();
    return null;
  } catch (e: any) {
    return NextResponse.json({ error: e?.status === 401 ? "Not authenticated" : "Forbidden" }, { status: e?.status || 403 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;
  const { status } = await req.json().catch(() => ({}));
  if (status !== "published" && status !== "hidden") return NextResponse.json({ error: "Status must be published or hidden." }, { status: 400 });
  const was = await prisma.review.findUnique({ where: { id: params.id }, select: { status: true } });
  if (!was) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  const review = await prisma.review.update({ where: { id: params.id }, data: { status }, select: { id: true, status: true } });
  if (was.status === "flagged" && status === "published") {
    await notifyArtistOfReview(review.id).catch((err) => console.error("Review email to artist failed", err));
  }
  return NextResponse.json({ ok: true, review });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await guard();
  if (denied) return denied;
  const gone = await prisma.review.deleteMany({ where: { id: params.id } });
  if (!gone.count) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
