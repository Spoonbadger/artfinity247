// POST /api/admin/settings/scanning  The painting scanning service's settings (lib/scanning.server.ts), saved in the
// admin settings snapshot. { enabled?, bands?, pickupFeeCents?, turnaroundDays?, returnDays?, dropoffAddress?, careText?, confirm?: [field] }
// Fields listed in `confirm` stop showing as "set by Craig" placeholders. Owners only.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { readScanSettings, writeScanSettings, type ScanSettingsInput } from "@/lib/scanning.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("settings");
  if (denied) return denied;
  const input = (await req.json().catch(() => null)) as ScanSettingsInput | null;
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Nothing came through. Refresh and try again." }, { status: 400 });
  const before = await readScanSettings();
  if (typeof input.enabled === "boolean" && before.enabledSource === "env") return NextResponse.json({ error: "SCANNING_SERVICE is set in the environment, which wins. Change it there." }, { status: 409 });
  try {
    await writeScanSettings(input, admin);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Couldn't save." }, { status: 400 });
  }
  const after = await readScanSettings();
  const changed = Object.keys(input).filter((k) => k !== "confirm");
  await logAdminAction(admin, "setting.scanning", { type: "setting", id: "scanning" }, `Scanning service settings: ${changed.join(", ") || "confirmed"}${typeof input.enabled === "boolean" ? ` (service ${input.enabled ? "on" : "off"})` : ""}`, { from: before, to: after });
  return NextResponse.json({ ok: true });
}
