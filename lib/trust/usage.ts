// Sightengine operations used this calendar month (UTC), counted from the stored check results:
// AdminAction "artwork.auto_check" (uploads) and "verification.auto_decision" (verification photos) keep
// `sightengineOps` in their details. Shown on /admin/settings/auto-approval against the free plan. Server only.
import { prisma } from "@/lib/prisma";

export async function sightengineOpsThisMonth(now = new Date()): Promise<number> {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await prisma.adminAction.findMany({
    where: { action: { in: ["artwork.auto_check", "verification.auto_decision"] }, createdAt: { gte: start }, details: { path: ["sightengineOps"], gt: 0 } },
    select: { details: true },
  }).catch(() => []);
  return rows.reduce((n, r) => n + (Number((r.details as Record<string, unknown> | null)?.sightengineOps) || 0), 0);
}
