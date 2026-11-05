// POST /api/admin/scanning/[id] { step, ...fields }  Moves a scan booking along (lib/scanning.server.ts adminStep):
//   confirm { date, price, dropoffInfo? } · received · scanning · delivered · returned · cancel { reason? } · note { note }
// Confirming (the price) and cancelling need the money role; the hands-on steps need orders. Each step is audit logged.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { ADMIN_STEPS, adminStep, ScanError, type AdminStep } from "@/lib/scanning.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DONE: Record<AdminStep, string> = {
  confirm: "Confirmed. The artist got an email to pay.",
  received: "Marked received. The artist got an email.",
  scanning: "Marked scanning.",
  delivered: "Delivered. The artist got an email.",
  returned: "Marked returned. Booking closed.",
  cancel: "Booking cancelled. The artist got an email.",
  note: "Note saved.",
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const step = ADMIN_STEPS.find((s) => s === body.step);
  if (!step) return NextResponse.json({ error: "Unknown step." }, { status: 400 });
  const { admin, denied } = await adminRoleGuard(step === "confirm" || step === "cancel" ? "money" : "orders");
  if (denied) return denied;
  try {
    await adminStep(params.id, step, body, admin);
    return NextResponse.json({ ok: true, message: DONE[step] });
  } catch (err) {
    if (err instanceof ScanError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[scanning] admin step failed", step, err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}
