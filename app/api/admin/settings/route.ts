// POST /api/admin/settings { testStartDate: "YYYY-MM-DD" | "" }  The 90-day test's start (data/admin-settings.json).
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { isDay, readAdminSettings, writeAdminSettings } from "@/lib/adminSettings";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = (await req.json().catch(() => ({}))) as { testStartDate?: unknown };
  const raw = typeof input.testStartDate === "string" ? input.testStartDate.trim() : "";
  if (raw && !isDay(raw)) return NextResponse.json({ error: "Use a date like 2026-11-01." }, { status: 400 });
  if (process.env.TEST_START_DATE) return NextResponse.json({ error: "TEST_START_DATE is set in the environment, which wins. Change it there." }, { status: 409 });
  const before = await readAdminSettings();
  try {
    await writeAdminSettings({ testStartDate: raw || undefined });
  } catch {
    return NextResponse.json({ error: "Couldn't save the settings file on this server. Set TEST_START_DATE in the environment instead." }, { status: 500 });
  }
  await logAdminAction(admin, "setting.test_start", { type: "setting", id: "testStartDate" }, raw ? `90-day test starts ${raw}` : "90-day test start reset to the first order", { from: before.testStartDate ?? null, to: raw || null });
  return NextResponse.json({ ok: true });
}
