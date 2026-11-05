// POST /api/admin/reprints/:id  { action: "approve" | "refund" | "decline", note? }
// approve: creates a zero-charge reprint order (kind "reprint") for the printer, emails the buyer.
// refund: marks it refunded (the refund itself is done in Stripe for now), emails the buyer.
// decline: needs a note for the buyer, emails them.
import { NextRequest, NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin";
import { decideRequest, ReprintError, type Decision } from "@/lib/reprints";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS: Decision[] = ["approve", "refund", "decline"];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const input = await req.json().catch(() => ({}));
  const action = ACTIONS.find((a) => a === input?.action);
  if (!action) return NextResponse.json({ error: "Pick approve, refund or decline." }, { status: 400 });
  const note = typeof input.note === "string" ? input.note.replace(/\r\n/g, "\n").trim().slice(0, 600) : "";
  try {
    return NextResponse.json({ ok: true, ...(await decideRequest(params.id, action, note)) });
  } catch (err) {
    if (err instanceof ReprintError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("Reprint decision failed", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
