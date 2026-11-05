// GET /api/cron/work-order-retries  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts. Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): Every hour at :07 (UTC and New York alike).
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("work-order-retries");
