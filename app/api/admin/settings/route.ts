// POST /api/admin/settings { testStartDate: "YYYY-MM-DD" | "" }  The 90-day test's start (data/admin-settings.json).
// POST /api/admin/settings { refundPaidOutPolicy: "absorb" | "deduct_next_payout" }  Paid-out refunds (lib/refundPolicy.ts).
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { isDay, readAdminSettings, writeAdminSettings } from "@/lib/adminSettings";
import { logAdminAction } from "@/lib/audit";
import { REFUND_POLICY_ACTION, REFUND_POLICY_LABEL, isRefundPolicy, mirrorPolicyToFile, refundPolicy } from "@/lib/refundPolicy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Settings: owners only (lib/adminRoles.ts).
  const { admin, denied } = await adminRoleGuard("settings");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as { testStartDate?: unknown; refundPaidOutPolicy?: unknown };

  if ("refundPaidOutPolicy" in input) {
    const to = input.refundPaidOutPolicy;
    if (!isRefundPolicy(to)) return NextResponse.json({ error: "Pick one of the options." }, { status: 400 });
    if (process.env.REFUND_PAID_OUT_POLICY) return NextResponse.json({ error: "REFUND_PAID_OUT_POLICY is set in the environment, which wins. Change it there." }, { status: 409 });
    const before = await refundPolicy();
    if (before.policy === to) return NextResponse.json({ ok: true, policy: to });
    // The audit row is the stored value (works on Vercel's read-only file system); the file is a local mirror.
    const row = await logAdminAction(admin, REFUND_POLICY_ACTION, { type: "setting", id: "refundPaidOutPolicy" },
      `Refunds after payout: ${REFUND_POLICY_LABEL[to]}`, { from: before.policy, to });
    if (!row) return NextResponse.json({ error: "Couldn't save the setting. Try again." }, { status: 500 });
    await mirrorPolicyToFile(to);
    return NextResponse.json({ ok: true, policy: to });
  }

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
