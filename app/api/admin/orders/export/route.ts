// GET /api/admin/orders/export?ids=a,b,c  One CSV row per print, for the lab: ship-to, size, frame, edition and
// signed links to the original file and packing slip (valid LINK_DAYS days, lib/printer.ts).
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { prisma } from "@/lib/prisma";
import { normalizeSize } from "@/lib/sales";
import { SIZE_LABEL } from "@/app/admin/_components/util";
import { orderNumber, originalLink, slipLink } from "@/lib/printer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest) {
  // The lab sheet (ship-to and signed original links) is order fulfilment: support handles that.
  const { admin, denied } = await adminRoleGuard("orders");
  if (denied) return denied;
  const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  if (!ids.length) return NextResponse.json({ error: "Pick some orders." }, { status: 400 });

  const orders = await prisma.order.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, createdAt: true, kind: true, shippingName: true, shippingAddress: true, email: true,
      items: { select: { id: true, title: true, artistName: true, size: true, frameChosen: true, frameColor: true, quantity: true, editionNumber: true, artwork: { select: { editionSize: true } } } },
    },
  });

  const header = ["order", "date", "kind", "ship_name", "ship_address", "title", "artist", "size", "frame", "quantity", "edition", "original_file", "packing_slip"];
  const rows = [header.join(",")];
  for (const o of orders) {
    for (const it of o.items) {
      const size = normalizeSize(it.size);
      const edition = it.editionNumber && it.artwork?.editionSize ? `${it.editionNumber}/${it.artwork.editionSize}` : "";
      rows.push([
        orderNumber(o.id), o.createdAt.toISOString().slice(0, 10), o.kind, o.shippingName, o.shippingAddress,
        it.title, it.artistName, SIZE_LABEL[size] ?? size, it.frameChosen ? `framed ${it.frameColor || ""}`.trim() : "none",
        it.quantity ?? 1, edition, originalLink(it.id), slipLink(o.id),
      ].map(cell).join(","));
    }
  }
  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="artfinity-lab-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
