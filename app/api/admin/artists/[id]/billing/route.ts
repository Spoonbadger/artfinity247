// POST /api/admin/artists/:id/billing  Infinity subscription actions (money role, audit-logged). lib/billing.ts.
//   { action: "cancel_at_period_end" }  stops renewal; Infinity stays to the period end
//   { action: "cancel_now" }            ends the subscription and Infinity now (no refund; refund in Stripe if owed)
//   { action: "resume" }                undoes a cancel at period end
//   { action: "sync" }                  re-reads the subscription from Stripe
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { BillingError, adminBillingAction, getBillingState } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS = ["cancel_at_period_end", "cancel_now", "resume", "sync"] as const;
type Action = (typeof ACTIONS)[number];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await adminRoleGuard("money");
  if (denied) return denied;
  const input = (await req.json().catch(() => ({}))) as { action?: unknown };
  const action = ACTIONS.find((a) => a === input.action) as Action | undefined;
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const artist = await prisma.artist.findUnique({ where: { id: params.id }, select: { id: true, artist_name: true, name: true, proUntil: true } });
  if (!artist) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  const before = await getBillingState(artist.id);
  try {
    const message = await adminBillingAction(artist.id, action);
    const after = await prisma.artist.findUnique({ where: { id: artist.id }, select: { proUntil: true } });
    if (action !== "sync" || before.status !== (await getBillingState(artist.id)).status) {
      await logAdminAction(admin, `artist.billing_${action}`, { type: "artist", id: artist.id }, `${message} (${artist.artist_name || artist.name})`, {
        subscriptionId: before.subscriptionId, statusBefore: before.status, proUntilBefore: artist.proUntil, proUntilAfter: after?.proUntil ?? null,
      });
    }
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    if (err instanceof BillingError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("admin billing action failed", action, artist.id, err);
    return NextResponse.json({ error: "Stripe didn't accept that. Check the subscription in Stripe." }, { status: 502 });
  }
}
