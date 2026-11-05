// GET /api/cron/social-publish  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/social/publish.ts (drafts for new art, token check, publishes approved Instagram posts on time).
// Logged as a JobRun; also runnable from /admin/jobs. Schedule: hourly at :05 UTC.
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export const GET = cronGet("social-publish");
