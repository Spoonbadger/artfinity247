// /api/admin/payouts/pay-all  The monthly payout run (lib/payouts.ts). Admins only.
// GET: what's ready (Stripe transfers vs Venmo by hand). POST: send the Stripe transfers.
import { NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { payReadyPayouts, readyPayouts } from "@/lib/payouts";
import { connectMode } from "@/lib/stripeConnect";
import { logAdminAction } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // Read-only list of what's ready; the panel shows it to support with the button disabled.
  const { denied } = await adminRoleGuard("view");
  if (denied) return denied;
  const ready = await readyPayouts();
  return NextResponse.json({ mode: connectMode(), ready }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  // Money: owner and admin only (lib/adminRoles.ts).
  const { admin, denied } = await adminRoleGuard("money");
  if (denied) return denied;
  try {
    const r = await payReadyPayouts({ source: "admin" });
    const total = r.paid.reduce((n, p) => n + p.amountCents, 0);
    await logAdminAction(admin, "payout.pay_all", { type: "payout" }, `Pay all: ${r.paid.length} sent ($${(total / 100).toFixed(2)}), ${r.failed.length} failed, ${r.manual.length} by hand`, {
      mode: r.mode,
      paid: r.paid.map((p) => ({ artistId: p.artistId, month: p.month, amountCents: p.amountCents, transferId: p.transferId })),
      failed: r.failed.map((f) => ({ artistId: f.artistId, month: f.month, reason: f.reason })),
    });
    // One row per artist too, so it shows in their audit trail.
    for (const p of r.paid) {
      await logAdminAction(admin, "payout.stripe_transfer", { type: "payout" }, `Stripe payout for ${p.month}: $${(p.amountCents / 100).toFixed(2)}`, { artistId: p.artistId, month: p.month, amountCents: p.amountCents, transferId: p.transferId });
    }
    return NextResponse.json(r);
  } catch (err) {
    console.error("Pay all failed", err);
    return NextResponse.json({ error: "Pay all failed. Nothing more was sent; check the server log." }, { status: 500 });
  }
}
