// POST /api/admin/alerts  Any admin.
//   { action: "resolve", id }            mark handled
//   { action: "reopen", id }
//   { action: "snooze", id, days }       1–14 days; kept as an "alert.snooze" audit row (lib/alerts.ts)
//   { action: "unsnooze", id }
//   { action: "sweep" }                  run the checks now (late payouts, stuck orders...; lib/alertSweep.ts)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { SNOOZE_ACTION, UNSNOOZE_ACTION } from "@/lib/alerts";
import { sweepAdminAlerts } from "@/lib/alertSweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { admin, denied } = await adminRoleGuard("view");
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (b.action === "sweep") {
    const r = await sweepAdminAlerts();
    return NextResponse.json({ ok: true, ...r, message: `Checked: ${r.raised} new, ${r.resolved} resolved` });
  }

  const id = typeof b.id === "string" ? b.id : "";
  const alert = id ? await prisma.adminAlert.findUnique({ where: { id } }) : null;
  if (!alert) return NextResponse.json({ error: "Alert not found." }, { status: 404 });
  const target = { type: "alert" as const, id: alert.id };

  switch (b.action) {
    case "resolve": {
      if (alert.resolvedAt) return NextResponse.json({ error: "Already resolved." }, { status: 409 });
      await prisma.adminAlert.update({ where: { id }, data: { resolvedAt: new Date() } });
      await logAdminAction(admin, "alert.resolve", target, `Resolved alert: ${alert.title}`, { key: alert.key, kind: alert.kind });
      return NextResponse.json({ ok: true, message: "Resolved" });
    }
    case "reopen": {
      if (!alert.resolvedAt) return NextResponse.json({ error: "It's open." }, { status: 409 });
      await prisma.adminAlert.update({ where: { id }, data: { resolvedAt: null } });
      await logAdminAction(admin, "alert.reopen", target, `Reopened alert: ${alert.title}`, { key: alert.key, kind: alert.kind });
      return NextResponse.json({ ok: true, message: "Reopened" });
    }
    case "snooze": {
      const days = Math.round(Number(b.days));
      if (!Number.isFinite(days) || days < 1 || days > 14) return NextResponse.json({ error: "Snooze for 1 to 14 days." }, { status: 400 });
      if (alert.resolvedAt) return NextResponse.json({ error: "Already resolved." }, { status: 409 });
      const until = new Date(Date.now() + days * 86_400_000);
      await logAdminAction(admin, SNOOZE_ACTION, target, `Snoozed alert for ${days} day${days === 1 ? "" : "s"}: ${alert.title}`, { key: alert.key, kind: alert.kind, until: until.toISOString() });
      return NextResponse.json({ ok: true, message: `Snoozed until ${until.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}` });
    }
    case "unsnooze": {
      await logAdminAction(admin, UNSNOOZE_ACTION, target, `Unsnoozed alert: ${alert.title}`, { key: alert.key, kind: alert.kind });
      return NextResponse.json({ ok: true, message: "Back in the list" });
    }
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
