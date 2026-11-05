// GET /api/cron/stuck-orders  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts. Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): Daily 12:23 UTC = 7:23am New York in winter (EST), 8:23am in summer (EDT).
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("stuck-orders");
