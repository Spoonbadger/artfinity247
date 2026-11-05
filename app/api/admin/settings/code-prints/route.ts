// POST /api/admin/settings/code-prints { unit: { label, sticker, tag, poster }, shipping, handling, infinityFreeShipping }
// Prices for printed, laminated codes mailed to artists (lib/codePrints.ts), all in cents, at cost. Owners only.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { cleanPricing, codePrintPricing, saveCodePrintPricing } from "@/lib/codePrints";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("settings");
  if (denied) return denied;
  const input = await req.json().catch(() => null);
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Something was missing. Refresh and try again." }, { status: 400 });
  const before = await codePrintPricing();
  const next = cleanPricing(input, before);
  try {
    await saveCodePrintPricing(next, { id: admin.id, email: admin.email });
  } catch {
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  const { placeholder: _p, ...from } = before;
  await logAdminAction(admin, "setting.code_prints", { type: "setting", id: "codePrints" }, "Code print prices updated", { from, to: next });
  return NextResponse.json({ ok: true, pricing: next });
}
