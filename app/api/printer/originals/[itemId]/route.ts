// GET /api/printer/originals/:orderItemId?e=<expiry>&t=<sig>  The print lab's download of an ordered print's original.
// Token variant of /api/admin/originals/[artworkId]: no login, but the link is signed for this one order line and
// expires (lib/printer.ts, LINK_DAYS). It serves the exact file the order was placed with.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { originalResponse } from "@/lib/storage";
import { orderNumber, verifyPrinterLink } from "@/lib/printer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { itemId: string } }) {
  const q = req.nextUrl.searchParams;
  if (!verifyPrinterLink(`orig:${params.itemId}`, q.get("e"), q.get("t"))) {
    return NextResponse.json({ error: "This download link is invalid or has expired. Ask Artfinity for a new work order." }, { status: 403 });
  }
  const item = await prisma.orderItem.findUnique({
    where: { id: params.itemId },
    select: { orderId: true, imageUrl: true, slug: true, size: true, artwork: { select: { slug: true, imageUrl: true } } },
  });
  const src = item?.imageUrl || item?.artwork?.imageUrl;
  if (!item || !src) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return originalResponse(src, `${orderNumber(item.orderId)}-${item.artwork?.slug || item.slug || "print"}-${item.size || ""}`);
}
