// POST /api/admin/reprints/:id  { action: "approve" | "refund" | "decline", note? }
// approve: creates a zero-charge reprint order (kind "reprint") for the printer, emails the buyer.
// refund: marks it refunded (the refund itself is done in Stripe for now), emails the buyer.
// decline: needs a note for the buyer, emails them.
import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { decideRequest, ReprintError, type Decision } from "@/lib/reprints";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { adminRoleGuard } from "@/lib/adminRoles";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS: Decision[] = ["approve", "refund", "decline"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = await req.json().catch(() => ({}));
  const action = ACTIONS.find((a) => a === input?.action);
  if (!action) return NextResponse.json({ error: "Pick approve, refund or decline." }, { status: 400 });
  // Refunds are money: owner and admin only. Support can approve or decline.
  if (action === "refund") {
    const { denied } = await adminRoleGuard("money");
    if (denied) return denied;
  }
  const note = typeof input.note === "string" ? input.note.replace(/\r\n/g, "\n").trim().slice(0, 600) : "";
  try {
    const r = await decideRequest(params.id, action, note);
    const msg = await prisma.message.findUnique({ where: { id: params.id }, select: { orderId: true } });
    const verb = action === "approve" ? "Approved reprint" : action === "refund" ? "Refunded instead of reprint" : "Declined reprint";
    await logAdminAction(admin, `reprint.${action}`, { type: "reprint", id: params.id }, `${verb}${msg?.orderId ? ` on order ${msg.orderId.slice(-8).toUpperCase()}` : ""}`, {
      orderId: msg?.orderId, reprintOrderId: r.reprintOrderId, note: note || undefined,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    if (err instanceof ReprintError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Reprint decision failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
