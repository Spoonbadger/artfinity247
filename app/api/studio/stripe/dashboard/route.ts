// POST /api/studio/stripe/dashboard  "Manage in Stripe": a one-time login link to the artist's Express dashboard.
import { NextRequest } from "next/server";
import { dashboardUrl } from "@/lib/stripeConnect";
import { go } from "../_go";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (req: NextRequest) => go(req, dashboardUrl);
