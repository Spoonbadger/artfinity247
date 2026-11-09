// POST /api/admin/scenes/build { fixtures?: boolean } : rebuilds data/scenes.json (same as npm run scenes:build).
import { NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { buildCatalog } from "@/lib/scenes/catalog";
import { scenesWritable } from "@/lib/scenes/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  // Scenes tooling changes the room previews every buyer sees: admin or owner.
  const { admin, denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  if (!scenesWritable()) return NextResponse.json({ error: "Build in development (npm run scenes:build), then deploy." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { fixtures?: boolean };
  const { report } = await buildCatalog({ fixtures: !!body.fixtures, write: true });
  await logAdminAction(admin, "scenes.build", { type: "scene" }, `Rebuilt the scenes catalog${body.fixtures ? " (with fixtures)" : ""}`, { report: report as unknown as Record<string, unknown> });
  return NextResponse.json({ report });
}
