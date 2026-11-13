// POST /api/webhook/prodigi?token=<PRODIGI_WEBHOOK_TOKEN>  Prodigi's order callbacks (lib/prodigiSync.ts).
// Prodigi sends the callbackUrl we put on each order (lib/printer.ts prodigiCallbackUrl) when the order's stage,
// a production step or a shipment changes. Callbacks aren't signed, so:
//   1. the URL carries a secret token, compared in constant time (refused in production when it isn't set)
//   2. the body is only used for the Prodigi order id: the order itself is fetched again from Prodigi's API
//   3. applying it is idempotent and never moves an order backwards, so repeats and out-of-order calls are harmless
// Answers 200 for anything it read (even an order that isn't ours) so Prodigi doesn't retry forever; 500 when Prodigi
// couldn't be reached, and the daily prodigi-sync job catches up either way.
import { NextRequest, NextResponse } from "next/server";
import { callbackOrderId, tokenMatches } from "@/lib/prodigi";
import { syncProdigiOrder } from "@/lib/prodigiSync";
import { usingProdigi } from "@/lib/printer";
import { rateLimit } from "@/lib/rateLimit";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.PRODIGI_WEBHOOK_TOKEN?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "PRODIGI_WEBHOOK_TOKEN is not set" }, { status: 503 });
    console.warn("[prodigi:webhook] PRODIGI_WEBHOOK_TOKEN is not set; accepting the callback (development only)");
  } else if (!tokenMatches(req.nextUrl.searchParams.get("token"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`prodigi-webhook:${ip}`, 600, 10 * 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const body = await req.json().catch(() => null);
  const prodigiId = callbackOrderId(body);
  if (!prodigiId) return NextResponse.json({ ignored: "no Prodigi order id" });
  if (!process.env.PRODIGI_API_KEY?.trim()) {
    // Can't confirm anything without the API: say so and let Prodigi try again later.
    console.error("[prodigi:webhook] PRODIGI_API_KEY is not set; can't fetch", prodigiId);
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  try {
    const r = await syncProdigiOrder(prodigiId);
    const type = body && typeof body === "object" && typeof (body as { type?: unknown }).type === "string" ? (body as { type: string }).type : "callback";
    console.log(`[prodigi:webhook] ${type} ${prodigiId}: ${r.ignored ?? (r.actions.join(", ") || "no change")}${r.orderId ? ` (order ${r.orderId})` : ""}${usingProdigi() ? "" : " [PRINTER_PROVIDER isn't prodigi]"}`);
    return NextResponse.json({ ok: true, orderId: r.orderId, phase: r.phase ?? null, actions: r.actions, ignored: r.ignored ?? null });
  } catch (err) {
    console.error("[prodigi:webhook] failed", prodigiId, (err as Error)?.message);
    await reportError(err, { area: "webhook", name: "prodigi", extra: { prodigiId } });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
