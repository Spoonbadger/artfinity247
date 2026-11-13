// GET /api/cron/work-order-retries  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts. Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): daily at 14:07 UTC (9:07am New York, 10:07am in summer).
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("work-order-retries");
