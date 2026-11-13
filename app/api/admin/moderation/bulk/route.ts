// POST /api/admin/moderation/bulk { ids: string[], action: "approve" | "reject" }  Same as one-by-one, for many.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { prisma } from "@/lib/prisma";
import { announceArtworkLive, resolveArtworkAlerts } from "@/lib/artworkLive";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX = 100;

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("moderation");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as { ids?: unknown; action?: unknown };
  const action = input.action === "approve" || input.action === "reject" ? input.action : null;
  const ids = Array.from(new Set((Array.isArray(input.ids) ? input.ids : []).filter((x): x is string => typeof x === "string"))).slice(0, MAX);
  if (!action) return NextResponse.json({ error: "Pick approve or reject." }, { status: 400 });
  if (!ids.length) return NextResponse.json({ error: "Select some artworks first." }, { status: 400 });

  const arts = await prisma.artwork.findMany({ where: { id: { in: ids } }, select: { id: true, title: true, status: true, artistId: true, flaggedReason: true } });
  const done: string[] = [];
  for (const a of arts) {
    try {
      await prisma.artwork.update({
        where: { id: a.id },
        data: action === "approve"
          ? { status: "APPROVED", flaggedReason: null, flaggedBy: null }
          : { status: "REJECTED", flaggedReason: "rejected_by_admin", flaggedBy: admin.id },
      });
      if (action === "approve" && a.status !== "APPROVED") await announceArtworkLive(a.id);
      await logAdminAction(admin, `artwork.${action}`, { type: "artwork", id: a.id }, `${action === "approve" ? "Approved" : "Rejected"} “${a.title}” (bulk)`, {
        artistId: a.artistId, from: a.status, flaggedReason: a.flaggedReason, bulk: true,
      });
      done.push(a.id);
    } catch (err) {
      console.error("Bulk moderation failed for", a.id, err);
    }
  }
  await resolveArtworkAlerts(done);
  return NextResponse.json({ ok: true, done, failed: ids.filter((id) => !done.includes(id)) });
}
