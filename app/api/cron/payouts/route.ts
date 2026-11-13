// GET /api/cron/payouts  Monthly run on the 5th (vercel.json: 15:17 UTC = 10:17am New York in winter, 11:17am in summer). Same as "Pay all" on /admin/payouts.
// Does nothing unless CRON_SECRET and STRIPE_SECRET_KEY are both set (never simulates), and only from the 5th on,
// so closed months are never paid early. Vercel sends "Authorization: Bearer <CRON_SECRET>".
// Runs through lib/jobs (JobRun log, overlap lock, alerts on failed transfers or a low Stripe balance): lib/jobs/monthly.ts.
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("payouts");
