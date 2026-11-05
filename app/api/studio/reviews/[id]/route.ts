// PATCH /api/studio/reviews/:id  { reply }  — the artist's one public reply to a review. Sending it again edits it;
// an empty reply removes it. Only on the artist's own published reviews.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { moderate } from "@/lib/reviews";

export const dynamic = "force-dynamic";

const MAX_REPLY = 500;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const input = await req.json().catch(() => ({}));
  const reply = String(input?.reply ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_REPLY);

  const review = await prisma.review.findUnique({ where: { id: params.id }, select: { artistId: true, status: true } });
  if (!review || review.artistId !== user.id) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (review.status !== "published") return NextResponse.json({ error: "This review isn't public, so it can't take a reply." }, { status: 409 });
  if (reply && moderate(reply) === "flagged") return NextResponse.json({ error: "Replies can't include links or rough language." }, { status: 400 });

  const saved = await prisma.review.update({
    where: { id: params.id },
    data: reply ? { artistReply: reply, artistReplyAt: new Date() } : { artistReply: null, artistReplyAt: null },
    select: { id: true, artistReply: true, artistReplyAt: true },
  });
  return NextResponse.json({ ok: true, review: saved });
}
