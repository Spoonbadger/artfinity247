// GET /api/studio/stripe/refresh  Stripe sends the artist here when an onboarding link expired: make a fresh one.
import { NextRequest } from "next/server";
import { onboardingUrl } from "@/lib/stripeConnect";
import { go } from "../_go";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const GET = (req: NextRequest) => go(req, onboardingUrl, { verified: true });
