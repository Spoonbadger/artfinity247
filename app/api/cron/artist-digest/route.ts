// GET /api/cron/artist-digest  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts. Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): Mondays 13:00 UTC (8am New York in winter, 9am in summer). Gated to Monday morning in New York.
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("artist-digest");
