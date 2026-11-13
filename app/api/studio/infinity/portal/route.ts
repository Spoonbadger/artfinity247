// POST /api/studio/infinity/portal → { url } of the Stripe Customer Portal (cancel, update card, invoices).
import { NextResponse } from "next/server";
import { createPortal } from "@/lib/billing";
import { baseUrlFrom, billingFailure, fail, signedInArtist } from "../_lib";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const artist = await signedInArtist();
  if (!artist || artist.closedAt) return fail("Log in first.", 401);
  try {
    return NextResponse.json({ url: await createPortal(artist.id, baseUrlFrom(req)) });
  } catch (err) {
    return billingFailure("infinity-portal", err);
  }
}
