// GET /api/cron/sweep  Raise time-based admin alerts (late payouts, orders not sent to the printer after 24h, shipped
// 10+ days without delivery, failed jobs) and resolve alerts whose problem is gone. The daily admin-digest cron runs
// this too; call it more often if you like. Same CRON_SECRET bearer auth as the other crons. Logged as JobRun "alert-sweep".
import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/jobs/run";
import { sweepAdminAlerts } from "@/lib/alertSweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ skipped: "CRON_SECRET is not set" });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await runJob("alert-sweep", async ({ now }) => {
    const s = await sweepAdminAlerts(now);
    return { summary: `${s.current} open conditions, ${s.raised} new alerts, ${s.resolved} resolved`, details: s };
  });
  return NextResponse.json(r, { status: r.status === "failed" ? 500 : 200 });
}
