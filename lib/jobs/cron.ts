// The handler behind every /api/cron/<job> route. Same protection as before: does nothing unless CRON_SECRET is set,
// and only answers "Authorization: Bearer <CRON_SECRET>" (what Vercel Cron sends). Each call runs the job through
// runJob (JobRun log, overlap lock, job_failed alert).
import { NextRequest, NextResponse } from "next/server";
import { jobByName } from "@/lib/jobs/registry";
import { runJob } from "@/lib/jobs/run";

export function cronGet(name: string) {
  return async function GET(req: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ skipped: "CRON_SECRET is not set" });
    if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const job = jobByName(name);
    if (!job) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
    const now = new Date();
    if (job.gate && !job.gate.ok(now)) return NextResponse.json({ skipped: job.gate.reason });
    const r = await runJob(job.name, job.run, { now, source: "cron" });
    return NextResponse.json(r, { status: r.status === "failed" ? 500 : 200 });
  };
}
