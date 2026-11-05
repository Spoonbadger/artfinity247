// The print lab's "Reply with tracking" link from the work order email (lib/printer.ts labTrackingLink).
//   GET  /api/printer/tracking?o=<orderId>&e=<expiry>&t=<sig>   a tiny form: carrier + tracking number
//   POST /api/printer/tracking                                   saves it (form post or JSON with the same o/e/t)
// No login: the link is signed per order (same HMAC as the lab's file and slip links) and expires after
// TRACKING_LINK_DAYS. Saving marks the order shipped, emails the buyer the tracking link and registers the number with
// the carrier tracking provider (lib/shipping), so nobody has to type tracking numbers into the admin.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAdminAction } from "@/lib/audit";
import { rateLimit } from "@/lib/rateLimit";
import { orderNumber, verifyPrinterLink } from "@/lib/printer";
import { CARRIERS, cleanTracking } from "@/lib/tracking";
import { getTracking, markShipped } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const LAB = { id: "print-lab", email: "print lab (tracking link)" };

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
body{font:16px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15161b;background:#f7f5f0;margin:0;padding:24px 16px}
main{max-width:460px;margin:0 auto;background:#fff;border:1px solid #e6e3dc;border-radius:16px;padding:22px}
h1{font-size:22px;margin:0 0 4px}.m{color:#5b5d66;font-size:14px;margin:0 0 18px}label{display:block;font-weight:600;font-size:14px;margin:14px 0 6px}
select,input{box-sizing:border-box;width:100%;font:inherit;padding:11px 12px;border:1.5px solid #c9c5bc;border-radius:10px;background:#fff}
button{margin-top:18px;width:100%;font:inherit;font-weight:700;color:#fff;background:#2b37f0;border:0;border-radius:999px;padding:13px}
.ok{background:#e6f5ee;border-radius:10px;padding:12px}.err{background:#fde8e4;border-radius:10px;padding:12px}
</style></head><body><main>${body}</main></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}

const denied = (json: boolean) =>
  json
    ? NextResponse.json({ error: "This link is invalid or has expired." }, { status: 403 })
    : page("Link expired", `<h1>This link doesn't work</h1><p class="m">It's invalid or has expired. Reply to the work order email with the tracking number instead.</p>`, 403);

function form(q: { o: string; e: string; t: string }, number: string, current: string | null, error?: string) {
  const options = CARRIERS.map((c) => `<option value="${c}">${c}</option>`).join("");
  return `<h1>Tracking for order #${esc(number)}</h1>
<p class="m">${current ? `Saved: ${esc(current)}. Enter a new one to replace it.` : "Once it ships, enter the carrier and number. The buyer gets the tracking email right away."}</p>
${error ? `<p class="err">${esc(error)}</p>` : ""}
<form method="post" action="/api/printer/tracking">
<input type="hidden" name="o" value="${esc(q.o)}"><input type="hidden" name="e" value="${esc(q.e)}"><input type="hidden" name="t" value="${esc(q.t)}">
<label for="carrier">Carrier</label><select id="carrier" name="carrier" required>${options}</select>
<label for="trackingNumber">Tracking number</label><input id="trackingNumber" name="trackingNumber" required autocomplete="off" inputmode="text" placeholder="9400 1000 0000 0000 0000 00">
<label for="trackingUrl">Tracking link (only for Other)</label><input id="trackingUrl" name="trackingUrl" type="url" placeholder="https://">
<button type="submit">Save tracking</button>
</form>`;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = { o: sp.get("o") || "", e: sp.get("e") || "", t: sp.get("t") || "" };
  if (!q.o || !verifyPrinterLink(`track:${q.o}`, q.e, q.t)) return denied(false);
  const order = await prisma.order.findUnique({ where: { id: q.o }, select: { id: true } });
  if (!order) return page("Not found", "<h1>Order not found</h1>", 404);
  const t = await getTracking(order.id);
  return page(`Tracking #${orderNumber(order.id)}`, form(q, orderNumber(order.id), t ? `${t.carrier} ${t.number}` : null));
}

export async function POST(req: NextRequest) {
  const isJson = (req.headers.get("content-type") || "").includes("application/json");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimit(`lab-tracking:${ip}`, 30, 10 * 60_000)) {
    return isJson ? NextResponse.json({ error: "Too many requests" }, { status: 429 }) : page("Slow down", "<h1>Too many tries</h1><p class='m'>Wait a few minutes and try again.</p>", 429);
  }
  let input: Record<string, unknown> = {};
  if (isJson) input = await req.json().catch(() => ({}));
  else {
    const fd = await req.formData().catch(() => null);
    fd?.forEach((v, k) => { if (typeof v === "string") input[k] = v; });
  }
  const q = { o: String(input.o ?? input.orderId ?? ""), e: String(input.e ?? ""), t: String(input.t ?? "") };
  if (!q.o || !verifyPrinterLink(`track:${q.o}`, q.e, q.t)) return denied(isJson);

  const order = await prisma.order.findUnique({ where: { id: q.o }, select: { id: true, kind: true, paymentStatus: true } });
  if (!order || (order.paymentStatus !== "paid" && order.kind !== "reprint")) {
    return isJson ? NextResponse.json({ error: "Order not found" }, { status: 404 }) : page("Not found", "<h1>Order not found</h1>", 404);
  }
  const clean = cleanTracking({ carrier: input.carrier, trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl });
  if ("error" in clean) {
    return isJson ? NextResponse.json({ error: clean.error }, { status: 400 }) : page("Check the tracking", form(q, orderNumber(order.id), null, clean.error), 400);
  }

  const r = await markShipped(order.id, clean.tracking);
  if (r.changed) {
    await logAdminAction(LAB, "order.ship", { type: "order", id: order.id }, `Print lab entered tracking: ${clean.tracking.carrier} ${clean.tracking.number}`, { to: "shipped", tracking: clean.tracking, source: "lab" });
  }
  const msg = r.shippedNow ? "Saved. The buyer has the tracking link." : r.changed ? "Updated. Thanks." : "Already saved. Thanks.";
  if (isJson) return NextResponse.json({ ok: true, shipped: r.shippedNow, changed: r.changed, message: msg });
  return page("Tracking saved", `<h1>Thank you</h1><p class="ok">${esc(msg)}</p><p class="m">Order #${esc(orderNumber(order.id))}: ${esc(clean.tracking.carrier)} ${esc(clean.tracking.number)}</p>`);
}
