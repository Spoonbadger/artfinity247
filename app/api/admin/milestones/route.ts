// POST /api/admin/milestones { <field>: number | null, ... }  The owner's numbers on /admin/milestones
// (lib/milestonesCalc.ts MilestoneInputs; money in cents). Fields left out keep their value; null clears one.
// Saved in the admin settings snapshot (lib/adminSettings.ts `milestones`), with an audit entry. Owners only.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { readAdminSettings, writeAdminSettings } from "@/lib/adminSettings";
import { logAdminAction } from "@/lib/audit";
import { ALL_FIELDS, FIELD_MAX, cleanInputs, type MilestoneInputs } from "@/lib/milestonesCalc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("settings");
  if (denied) return denied;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Nothing came through. Refresh and try again." }, { status: 400 });

  const before = cleanInputs((await readAdminSettings()).milestones);
  const next: MilestoneInputs = { ...before };
  const changed: string[] = [];
  for (const k of ALL_FIELDS) {
    if (!(k in body)) continue;
    const v = body[k];
    if (v === null || v === "") {
      if (next[k] != null) changed.push(k);
      delete next[k];
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return NextResponse.json({ error: "Use numbers of 0 or more." }, { status: 400 });
    if (v > FIELD_MAX[k]) return NextResponse.json({ error: k === "bulkDiscountPct" ? "Discount: 0% to 100%." : "That number looks too big. Check for an extra zero." }, { status: 400 });
    const clean = k.endsWith("Cents") ? Math.round(v) : Math.round(v * 100) / 100;
    if (next[k] !== clean) changed.push(k);
    next[k] = clean;
  }
  if (!changed.length) return NextResponse.json({ ok: true, milestones: next });

  try {
    await writeAdminSettings({ milestones: next }, { id: admin.id, email: admin.email });
  } catch {
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }
  await logAdminAction(admin, "setting.milestones", { type: "setting", id: "milestones" }, `Milestone numbers updated: ${changed.join(", ")}`, { from: before, to: next });
  return NextResponse.json({ ok: true, milestones: next });
}
