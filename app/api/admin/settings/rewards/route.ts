// POST /api/admin/settings/rewards { enabled, every, pct }  Collector rewards (lib/collectorRewards.ts), saved to
// data/admin-settings.json. Env (COLLECTOR_REWARDS…) wins when set. Owners only.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { writeAdminSettings, type AdminSettings } from "@/lib/adminSettings";
import { logAdminAction } from "@/lib/audit";
import { rewardSettings } from "@/lib/collectorRewards";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("settings");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as { enabled?: unknown; every?: unknown; pct?: unknown };
  const every = Math.round(Number(input.every));
  const pct = Math.round(Number(input.pct));
  if (!Number.isFinite(every) || every < 2 || every > 50) return NextResponse.json({ error: "Prints per reward: 2 to 50." }, { status: 400 });
  if (!Number.isFinite(pct) || pct < 5 || pct > 30) return NextResponse.json({ error: "Discount: 5% to 30%." }, { status: 400 });
  const before = await rewardSettings();
  if (before.source === "env") return NextResponse.json({ error: "COLLECTOR_REWARDS is set in the environment, which wins. Change it there." }, { status: 409 });
  const next = { enabled: input.enabled === true, every, pct };
  try {
    await writeAdminSettings({ collectorRewards: next } as Record<string, unknown> as AdminSettings);
  } catch {
    return NextResponse.json({ error: "Couldn't save the settings file on this server. Set COLLECTOR_REWARDS, COLLECTOR_REWARD_EVERY and COLLECTOR_REWARD_PCT in the environment instead." }, { status: 500 });
  }
  await logAdminAction(admin, "setting.collector_rewards", { type: "setting", id: "collectorRewards" }, next.enabled ? `Collector rewards on: every ${every}th print, ${pct}% off` : "Collector rewards off", { from: before, to: next });
  return NextResponse.json({ ok: true });
}
