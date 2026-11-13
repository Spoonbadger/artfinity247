// GET /api/cron/prodigi-sync  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts (lib/prodigiSync.ts runProdigiSync). Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): daily at 14:37 UTC (9:37am New York, 10:37am in summer).
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("prodigi-sync");
