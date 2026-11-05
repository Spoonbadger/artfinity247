// /api/admin/payouts/pay-all  The monthly payout run (lib/payouts.ts). Admins only.
// GET: what's ready (Stripe transfers vs Venmo by hand). POST: send the Stripe transfers.
import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { payReadyPayouts, readyPayouts } from "@/lib/payouts";
import { connectMode } from "@/lib/stripeConnect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const ready = await readyPayouts();
  return NextResponse.json({ mode: connectMode(), ready }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await payReadyPayouts({ source: "admin" }));
  } catch (err) {
    console.error("Pay all failed", err);
    return NextResponse.json({ error: "Pay all failed. Nothing more was sent; check the server log." }, { status: 500 });
  }
}
