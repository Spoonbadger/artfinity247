// POST /api/shipping/mock  { orderId, status: "in_transit" | "delivered" | "problem" }   Development only, admins only.
// Simulates a carrier tracking event for an order that has a tracking number, through the same parser and handler as a
// real Shippo webhook. Returns 404 in production, whatever the env.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdmin } from "@/lib/admin";
import { applyTrackingEvent } from "@/lib/shipping";
import { getTracking } from "@/lib/shipping/store";
import { mockAllowed, parseWebhook } from "@/lib/shipping/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS = { in_transit: "TRANSIT", delivered: "DELIVERED", problem: "FAILURE", pre_transit: "PRE_TRANSIT" } as const;

export async function POST(req: NextRequest) {
  if (!mockAllowed()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await getAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = await req.json().catch(() => ({}));
  const orderId = String(input?.orderId ?? "");
  const status = STATUS[input?.status as keyof typeof STATUS];
  if (!status) return NextResponse.json({ error: "status must be in_transit, delivered, problem or pre_transit" }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const t = await getTracking(order.id);
  if (!t) return NextResponse.json({ error: "Add a tracking number to the order first." }, { status: 409 });
  // A Shippo-shaped track_updated event.
  const ev = parseWebhook({
    event: "track_updated",
    data: { carrier: t.carrier.toLowerCase(), tracking_number: t.number, metadata: `order:${order.id}`, tracking_status: { status, status_details: `Simulated ${input.status}`, status_date: new Date().toISOString() } },
  });
  if (!ev) return NextResponse.json({ error: "Couldn't build the event" }, { status: 500 });
  const r = await applyTrackingEvent({ ...ev, provider: "mock" });
  console.log(`[shipping:mock] ${t.number} ${input.status}: ${r.action}`);
  return NextResponse.json({ ok: true, ...r });
}
