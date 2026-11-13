// POST /api/admin/payouts/undo {artistId, month}  Undo a TEST payout (a simulated "tr_sim_" transfer from test mode).
// Payouts are Stripe-only: there's no "mark paid by hand" any more, and a real transfer or an old payout made outside
// Stripe can't be undone here (undoing it would make the next run pay that month again).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { unsettleCarried } from "@/lib/payouts";
import { SIM_TRANSFER } from "@/lib/stripeConnect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Money: owner and admin only (lib/adminRoles.ts).
  const { admin, denied } = await adminRoleGuard("money");
  if (denied) return denied;

  const { artistId, month } = await req.json().catch(() => ({}));
  if (!artistId || !month) return NextResponse.json({ error: "artistId and month required" }, { status: 400 });

  const existing = await prisma.payout.findUnique({
    where: { artistId_month: { artistId, month } },
    select: { id: true, paidAt: true, amountCents: true, stripeTransferId: true },
  });
  if (!existing?.paidAt) return NextResponse.json({ error: "This month isn't paid." }, { status: 409 });
  if (!existing.stripeTransferId?.startsWith(SIM_TRANSFER)) {
    return NextResponse.json({ error: existing.stripeTransferId ? `Paid by Stripe transfer ${existing.stripeTransferId}. Reverse it in Stripe first.` : "Only test payouts can be undone here." }, { status: 409 });
  }

  // $0 months settled along with this one (a refund adjustment used them up) go back to unpaid too.
  await unsettleCarried(artistId, existing.paidAt);
  const payout = await prisma.payout.update({
    where: { id: existing.id },
    data: { paidAt: null, method: null, stripeTransferId: null, failureReason: null },
  });
  await logAdminAction(admin, "payout.unmark_paid", { type: "payout", id: payout.id }, `Undid test payout for ${month}`, { artistId, month, amountCents: existing.amountCents, transferId: existing.stripeTransferId });
  return NextResponse.json({ payout, markedPaid: false });
}
