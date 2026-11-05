// POST /api/studio/infinity/checkout { interval?: "month" | "year" } → { url } of a Stripe Checkout page
// (subscription mode, lib/billing.ts). Without Stripe keys: 503 (test mode uses /api/studio/infinity/test).
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { createCheckout } from "@/lib/billing";
import { baseUrlFrom, billingFailure, fail, signedInArtist } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const artist = await signedInArtist();
  if (!artist || artist.closedAt) return fail("Log in first.", 401);
  if (artist.suspendedAt) return fail("Your account is paused, so Infinity can't be started right now.", 403);
  if (!rateLimit(`infinity-checkout:${artist.id}`, 10, 10 * 60_000)) return fail("Easy there. Try again in a few minutes.", 429);
  const body = (await req.json().catch(() => ({}))) as { interval?: unknown };
  const interval = body.interval === "year" ? "year" : "month";
  try {
    return NextResponse.json({ url: await createCheckout(artist.id, interval, baseUrlFrom(req)) });
  } catch (err) {
    return billingFailure("infinity-checkout", err);
  }
}
