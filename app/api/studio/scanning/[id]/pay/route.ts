// POST /api/studio/scanning/[id]/pay → { url }  Stripe Checkout for a confirmed scan booking. Without Stripe keys
// (localhost, staging with ALLOW_TEST_CHECKOUT=1) the booking is marked paid right away and { url, dev: true } comes back.
import { NextResponse } from "next/server";
import { activeUserGuard } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { scanCheckout } from "@/lib/scanning.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { user, denied } = await activeUserGuard("Log in to keep going.");
  if (denied) return denied;
  if (!rateLimit(`scan-pay:${user.id}`, 10, 10 * 60_000)) return NextResponse.json({ error: "Easy there. Try again in a few minutes.", code: "rate_limited" }, { status: 429 });
  return scanCheckout(req, user.id, params.id);
}
