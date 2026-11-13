// POST /api/admin/payouts/remind {artistId}  "Send reminder" on /admin/payouts → Waiting on Stripe setup.
// Emails the artist a link to Studio → Money to connect Stripe. At most one per artist per 7 days (the monthly email
// counts too), recorded in AdminAction "payout.reminder" (lib/payouts.ts sendStripeReminder).
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { sendStripeReminder } from "@/lib/payouts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

export async function POST(req: NextRequest) {
  // Like resending an email confirmation: support can do it (lib/adminCaps.ts).
  const { admin, denied } = await adminRoleGuard("accountSupport");
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const artistId = typeof body?.artistId === "string" ? body.artistId : "";
  if (!artistId) return NextResponse.json({ error: "artistId required" }, { status: 400 });

  const r = await sendStripeReminder(artistId, { by: admin, source: "admin" });
  if (r.ok) return NextResponse.json(r);
  if (r.reason === "rate_limited") return NextResponse.json({ ...r, error: `Already reminded this week. Next one from ${day(r.nextAt)}.` }, { status: 429 });
  if (r.reason === "closed") return NextResponse.json({ ...r, error: "This account is closed, so the Studio link won't open. Reopen it first." }, { status: 409 });
  if (r.reason === "not_waiting") return NextResponse.json({ ...r, error: "Nothing is held for this artist any more." }, { status: 409 });
  return NextResponse.json({ ...r, error: "The email didn't send. Try again in a minute." }, { status: 502 });
}
