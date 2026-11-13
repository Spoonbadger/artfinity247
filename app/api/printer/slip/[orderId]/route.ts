// GET /api/printer/slip/:orderId?e=<expiry>&t=<sig>  Printable packing slip for the print lab (no login; signed link
// from the work order email, lib/printer.ts). Same content as /admin/orders/[id]/slip: ship-to, prints, parcel note.
import { NextRequest, NextResponse } from "next/server";
import { buildWorkOrder, verifyPrinterLink } from "@/lib/printer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
  const q = req.nextUrl.searchParams;
  if (!verifyPrinterLink(`slip:${params.orderId}`, q.get("e"), q.get("t"))) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 403 });
  }
  const wo = await buildWorkOrder(params.orderId);
  if (!wo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = wo.items
    .map((i) => `<tr><td><b>${esc(i.title)}</b><div class="m">${esc(i.artist)}</div></td><td>${esc(i.size)}, ${esc(i.inches)}<div class="m">${esc(i.frame)}</div></td><td class="r">${i.quantity}</td></tr>`)
    .join("");
  const notes = wo.parcelNotes
    .map((n) => `<figure><blockquote>${esc(n.body.trim()).replace(/\n/g, "<br>")}</blockquote><figcaption>— ${esc(n.artist)}</figcaption></figure>`)
    .join("");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Packing slip #${wo.number}</title>
<style>
@page{size:letter;margin:.6in}body{font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#15161b;max-width:7.3in;margin:24px auto;padding:0 16px}
.top{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.e{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#5b5d66}
table{width:100%;border-collapse:collapse;margin:20px 0}th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5b5d66;padding-bottom:6px}
td{border-top:1px solid #e6e3dc;padding:6px 8px 6px 0;vertical-align:top}.r{text-align:right}.m{font-size:12px;color:#5b5d66}
figure{margin:0 0 12px;border:1.5px dashed #999;border-radius:12px;padding:20px;break-inside:avoid}blockquote{margin:0 0 12px;font-size:16px}figcaption{font-weight:600}
</style></head><body>
<div class="top"><div><div class="e">Ship to</div><b style="font-size:16px">${esc(wo.shipName)}</b><div>${esc(wo.shipAddress)}</div></div>
<div style="text-align:right"><div class="e">${wo.reprintOf ? "Reprint" : "Order"}</div><div>#${wo.number}</div><div class="m">${wo.placedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}</div></div></div>
<table><thead><tr><th>Print</th><th>Size</th><th class="r">Qty</th></tr></thead><tbody>${rows}</tbody></table>
${notes ? `<div class="e" style="margin-bottom:8px">Put this note in the parcel</div>${notes}` : ""}
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" } });
}
