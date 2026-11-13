// GET /api/studio/stripe/return  Back from Stripe onboarding: re-read the account, then show Money.
import { NextRequest } from "next/server";
import { refreshFromStripe } from "@/lib/stripeConnect";
import { go } from "../_go";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (req: NextRequest) =>
  go(req, async (artistId) => `/studio/money?stripe=${(await refreshFromStripe(artistId)) === "ready" ? "ready" : "pending"}`);
