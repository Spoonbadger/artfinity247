// POST /api/studio/stripe/connect  "Connect with Stripe" / "Finish setup": creates the artist's Express account
// if needed and sends them to Stripe's onboarding (simulated without Stripe keys, see lib/stripeConnect.ts).
import { NextRequest } from "next/server";
import { onboardingUrl } from "@/lib/stripeConnect";
import { go } from "../_go";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: NextRequest) => go(req, onboardingUrl);
