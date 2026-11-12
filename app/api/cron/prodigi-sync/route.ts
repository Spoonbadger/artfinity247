// GET /api/cron/prodigi-sync  Vercel Cron (vercel.json), "Authorization: Bearer <CRON_SECRET>".
// What it does: lib/jobs/registry.ts (lib/prodigiSync.ts runProdigiSync). Logged as a JobRun; also runnable from /admin/jobs.
// Schedule (vercel.json): Every hour at :37.
import { cronGet } from "@/lib/jobs/cron";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = cronGet("prodigi-sync");
