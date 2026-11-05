// POST /api/shipping/webhook  Carrier tracking updates from Shippo or EasyPost (lib/shipping/providers.ts).
// Auth: SHIPPING_WEBHOOK_SECRET as ?token=<secret> (Shippo, or either) or EasyPost's X-Hmac-Signature. Without the
// secret it's refused in production; in development unsigned payloads are accepted so they can be tried locally.
// Always answers 200 for events it read (even ones matching no order) so the provider doesn't retry forever.
import { NextRequest, NextResponse } from "next/server";
import { applyTrackingEvent } from "@/lib/shipping";
import { checkWebhook, isProduction, parseWebhook } from "@/lib/shipping/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const auth = checkWebhook(raw, req.nextUrl, req.headers);
  if (auth === "denied") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth === "unconfigured") {
    if (isProduction()) return NextResponse.json({ error: "SHIPPING_WEBHOOK_SECRET is not set" }, { status: 503 });
    console.warn("[shipping:webhook] SHIPPING_WEBHOOK_SECRET is not set; accepting an unsigned event (development only)");
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const ev = parseWebhook(body);
  if (!ev) return NextResponse.json({ ignored: true });
  const r = await applyTrackingEvent(ev);
  console.log(`[shipping:webhook] ${ev.provider} ${ev.trackingNumber} ${ev.status}: ${r.action}${r.orderId ? ` (order ${r.orderId})` : ""}`);
  return NextResponse.json({ ok: true, ...r });
}
