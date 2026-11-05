// POST /api/admin/scenes/build { fixtures?: boolean } : rebuilds data/scenes.json (same as npm run scenes:build).
import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { buildCatalog } from "@/lib/scenes/catalog";
import { scenesWritable } from "@/lib/scenes/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = await adminGuard();
  if (denied) return denied;
  if (!scenesWritable()) return NextResponse.json({ error: "Build in development (npm run scenes:build), then deploy." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { fixtures?: boolean };
  const { report } = await buildCatalog({ fixtures: !!body.fixtures, write: true });
  return NextResponse.json({ report });
}
