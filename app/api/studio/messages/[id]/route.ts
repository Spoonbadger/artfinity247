// DELETE /api/studio/messages/:id : removes one of the artist's private notes. Sent emails stay on record.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { user, denied } = await activeUserGuard();
  if (denied) return denied;
  const { count } = await prisma.message.deleteMany({ where: { id: params.id, artistId: user.id, direction: "note" } });
  if (!count) return NextResponse.json({ error: "That note is already gone. Refresh the page.", code: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
