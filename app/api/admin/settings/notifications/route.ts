// POST /api/admin/settings/notifications  { prefs: { <kind>: "instant" | "digest" | "off" } }
// The signed-in admin's own alert email choices (Artist.adminNotify). Kinds left out use the default.
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { ALERT_KINDS, parseNotifyPrefs } from "@/lib/alertKinds";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("view");
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { prefs?: unknown };
  const known = new Set(ALERT_KINDS.map((k) => k.kind as string));
  const prefs = Object.fromEntries(Object.entries(parseNotifyPrefs(b.prefs)).filter(([k]) => known.has(k)));
  await prisma.artist.update({ where: { id: admin.id }, data: { adminNotify: prefs as Prisma.InputJsonValue } });
  await logAdminAction(admin, "setting.alert_emails", { type: "setting", id: admin.id }, "Changed their alert email settings", { prefs });
  return NextResponse.json({ ok: true, prefs, message: "Saved" });
}
