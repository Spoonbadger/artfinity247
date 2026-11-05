// GET /api/cron/artist-digest  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts. Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): Mondays 13:00 and 14:00 UTC; only the run that is 9am in New York sends (14:00 in EST, 13:00 in EDT).
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("artist-digest");
