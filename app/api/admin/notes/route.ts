// POST /api/admin/notes { targetType: "artist" | "order", targetId, body }  A support note on an artist or order.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Internal notes: anyone on the admin team.
  const { admin, denied } = await adminRoleGuard("view");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as { targetType?: string; targetId?: string; body?: string };
  const targetType = input.targetType === "artist" || input.targetType === "order" ? input.targetType : null;
  const targetId = typeof input.targetId === "string" ? input.targetId.trim() : "";
  const body = typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim().slice(0, 4000) : "";
  if (!targetType || !targetId) return NextResponse.json({ error: "Missing target." }, { status: 400 });
  if (!body) return NextResponse.json({ error: "Write a note first." }, { status: 400 });
  const exists = targetType === "artist"
    ? await prisma.artist.count({ where: { id: targetId } })
    : await prisma.order.count({ where: { id: targetId } });
  if (!exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const note = await prisma.adminNote.create({
    data: { targetType, targetId, adminEmail: admin.email || "", body },
    select: { id: true, adminEmail: true, body: true, createdAt: true },
  });
  await logAdminAction(admin, "note.add", { type: targetType, id: targetId }, `Note: ${body.slice(0, 120)}`, { noteId: note.id });
  return NextResponse.json({ note });
}
