// GET /api/cron/payouts  Optional monthly run on the 5th (vercel.json). Same as "Pay all" on /admin/payouts.
// Does nothing unless CRON_SECRET and STRIPE_SECRET_KEY are both set (never simulates), and only from the 5th on,
// so closed months are never paid early. Vercel sends "Authorization: Bearer <CRON_SECRET>".
import { NextRequest, NextResponse } from "next/server";
import { PAYOUT_DAY_OF_MONTH } from "@/lib/balance";
import { lastClosedMonth, payReadyPayouts } from "@/lib/payouts";
import { connectMode } from "@/lib/stripeConnect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ skipped: "CRON_SECRET is not set" });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (connectMode() !== "live") return NextResponse.json({ skipped: "STRIPE_SECRET_KEY is not set" });
  const now = new Date();
  if (now.getUTCDate() < PAYOUT_DAY_OF_MONTH) return NextResponse.json({ skipped: `Payouts go out from the ${PAYOUT_DAY_OF_MONTH}th` });

  const r = await payReadyPayouts({ now, source: "cron" });
  const summary = {
    month: lastClosedMonth(now),
    paid: r.paid.length,
    paidCents: r.paid.reduce((n, p) => n + p.amountCents, 0),
    failed: r.failed.map((f) => ({ artistId: f.artistId, month: f.month, reason: f.reason })),
    venmoByHand: r.manual.map((m) => ({ artistId: m.artistId, totalCents: m.totalCents })),
    insufficientFunds: r.insufficientFunds,
  };
  console.log("[cron:payouts]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
