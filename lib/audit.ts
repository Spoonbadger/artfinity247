// Admin audit log: who did what, from every admin mutation. Server only.
// Writing the log never breaks the action it records: failures are logged and swallowed.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditAdmin = { id: string; email?: string | null };
export type AuditTargetType = "artist" | "artwork" | "order" | "review" | "report" | "payout" | "reprint" | "scene" | "setting" | "alert" | "invite" | "venue";
export type AuditTarget = { type: AuditTargetType; id?: string | null };

export async function logAdminAction(
  admin: AuditAdmin | null | undefined,
  action: string,
  target: AuditTarget,
  summary: string,
  details?: Record<string, unknown> | null,
) {
  if (!admin?.id) return null;
  try {
    return await prisma.adminAction.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email || "",
        action,
        targetType: target.type,
        targetId: target.id ?? null,
        summary: summary.slice(0, 500),
        details: details ? (JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue) : undefined,
      },
      select: { id: true },
    });
  } catch (err) {
    console.error("AUDIT_LOG_FAIL", action, target, err);
    return null;
  }
}

/** Where an audit row's target lives in the admin, or null. */
export function auditTargetHref(targetType: string, targetId: string | null, details?: unknown): string | null {
  if (!targetId) return null;
  const d = (details && typeof details === "object" ? details : {}) as Record<string, unknown>;
  switch (targetType) {
    case "artist": return `/admin/artists/${targetId}`;
    case "order": return `/admin/orders/${targetId}`;
    case "artwork": return `/admin/artworks/${targetId}/edit`;
    case "reprint": return typeof d.orderId === "string" ? `/admin/orders/${d.orderId}` : "/admin/reprints";
    case "review": return "/admin/reviews";
    case "report": return "/admin/reports";
    case "payout": return typeof d.artistId === "string" ? `/admin/artists/${d.artistId}` : "/admin/payouts";
    case "scene": return "/admin/scenes";
    case "alert": return "/admin/alerts";
    case "invite": return "/admin/team";
    case "venue": return `/admin/venues/${targetId}`;
    default: return null;
  }
}
