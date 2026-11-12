// POST /api/admin/settings/trust { autoApprove, autoVerify, spotCheckEvery, velocityN, minAccountDays }
// Artwork auto-approval and auto-verification (lib/trust/config.ts), saved in the admin settings. Owners only, audited.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { writeAdminSettings } from "@/lib/adminSettings";
import { logAdminAction } from "@/lib/audit";
import { parseTrustInput } from "@/lib/trust/config";
import { trustSettings } from "@/lib/trust/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("settings");
  if (denied) return denied;
  const parsed = parseTrustInput(await req.json().catch(() => null));
  if (parsed.error !== undefined) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const before = await trustSettings();
  const next = parsed.value;
  try {
    await writeAdminSettings({ trust: next }, { id: admin.id, email: admin.email ?? undefined });
  } catch {
    return NextResponse.json({ error: "Couldn't save the setting. Try again." }, { status: 500 });
  }
  const sw = (on: boolean) => (on ? "on" : "off");
  await logAdminAction(admin, "setting.trust", { type: "setting", id: "trust" },
    `Auto-approval ${sw(next.autoApprove)}, auto-verify ${sw(next.autoVerify)}, spot check 1 in ${next.spotCheckEvery || "never"}, ${next.velocityN} uploads a day for new artists, ${next.minAccountDays} days to verify`,
    { from: { autoApprove: before.autoApprove, autoVerify: before.autoVerify, spotCheckEvery: before.spotCheckEvery, velocityN: before.velocityN, minAccountDays: before.minAccountDays }, to: next });
  return NextResponse.json({ ok: true });
}
