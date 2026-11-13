// POST /api/admin/jobs/run { job }  "Run now" on /admin/jobs. Owner or admin only (money jobs need the money
// capability). Runs the job right away through runJob (logged, never overlapping a running one), ignoring its
// schedule window; jobs keep their own safety checks (payouts only with real Stripe keys, digests once a week each).
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { jobByName } from "@/lib/jobs/registry";
import { runJob } from "@/lib/jobs/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("admin");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const job = jobByName(String(body?.job ?? ""));
  if (!job) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  if (job.money) {
    const m = await adminRoleGuard("money");
    if (m.denied) return m.denied;
  }
  const r = await runJob(job.name, job.run, { source: "manual", by: admin.email ?? admin.id });
  await logAdminAction(admin, "job.run", { type: "setting", id: job.name }, `Ran "${job.label}" by hand: ${r.status === "skipped" ? r.reason : r.summary}`);
  if (r.status === "skipped") return NextResponse.json({ ...r, message: `Skipped: ${r.reason}` });
  return NextResponse.json({ ...r, message: r.summary }, { status: r.status === "failed" ? 500 : 200 });
}
