// GET /api/cron/admin-digest  Daily, about 8am New York (vercel.json, 12:07 UTC). Vercel sends
// "Authorization: Bearer <CRON_SECRET>"; does nothing without CRON_SECRET.
// 1. sweep: raise time-based alerts (late payouts, stuck orders...) and resolve stale ones (lib/alertSweep.ts)
// 2. digest: one short email per admin with what's new since the last digest, skipped when nothing is (lib/alerts.ts)
// Each run is a JobRun row ("admin-digest"); a failed run raises a job_failed alert (lib/jobs/run.ts).
import { NextRequest, NextResponse } from "next/server";
import { runJob } from "@/lib/jobs/run";
import { sweepAdminAlerts } from "@/lib/alertSweep";
import { sendAdminDigest } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ skipped: "CRON_SECRET is not set" });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const r = await runJob("admin-digest", async ({ now }) => {
    const sweep = await sweepAdminAlerts(now);
    const digest = await sendAdminDigest(now);
    const summary = digest.skipped
      ? `No digest: ${digest.skipped.toLowerCase()} (sweep: ${sweep.raised} new, ${sweep.resolved} resolved)`
      : `Digest of ${digest.alerts} alert${digest.alerts === 1 ? "" : "s"} to ${digest.sent.length} admin${digest.sent.length === 1 ? "" : "s"} (sweep: ${sweep.raised} new, ${sweep.resolved} resolved)`;
    return { summary, details: { sweep, digest } };
  });
  console.log("[cron:admin-digest]", JSON.stringify(r));
  return NextResponse.json(r, { status: r.status === "failed" ? 500 : 200 });
}
