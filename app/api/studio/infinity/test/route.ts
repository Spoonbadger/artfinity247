// POST /api/studio/infinity/test { action, interval? } : simulated Infinity subscription for localhost and staging.
// Only without STRIPE_SECRET_KEY, behind the test-checkout gate, never on a production deploy (lib/billing.ts
// billingMode). Actions: subscribe | cancel | resume | payment_failed | payment_fixed | end.
import { NextResponse } from "next/server";
import { billingMode, simulate, type SimAction } from "@/lib/billing";
import { billingFailure, fail, signedInArtist } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS: SimAction[] = ["subscribe", "cancel", "resume", "payment_failed", "payment_fixed", "end"];

export async function POST(req: Request) {
  if (billingMode() !== "simulated") return fail("Test billing is off here.", 403, "billing_off");
  const artist = await signedInArtist();
  if (!artist || artist.closedAt) return fail("Log in first.", 401);
  const body = (await req.json().catch(() => ({}))) as { action?: unknown; interval?: unknown };
  const action = ACTIONS.find((a) => a === body.action);
  if (!action) return fail("That test action isn't one we know. Refresh the page and try again.", 400, "bad_action");
  try {
    const res = await simulate(artist.id, action, new Date(), body.interval === "year" ? "year" : "month");
    return NextResponse.json({ ok: true, ...res });
  } catch (err) {
    return billingFailure("infinity-test", err);
  }
}
