// GET /api/admin/code-orders/:id/pdf?format=label → the print-ready PDF for one format of a mailed code order: the
// order's snapshot, different pieces packed onto the same sheets with crop marks (generateMixedQrPdf), order number in
// the footer. Opening it is logged.
import { NextRequest, NextResponse } from "next/server";
import { adminRoleGuard } from "@/lib/adminRoles";
import { logAdminAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { generateMixedQrPdf } from "@/lib/generateQrPdf";
import { FORMATS, sanitizeDesign, type ArtInfo } from "@/components/qr/card";
import { orderItems } from "@/lib/codePrints";
import { codeOrderNumber } from "@/lib/printQueueFormat";
import { isFormat } from "@/lib/printQueue";
import { pdfHeaders } from "../../../../qr/art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { admin, denied } = await adminRoleGuard("orders");
  if (denied) return denied;
  const format = req.nextUrl.searchParams.get("format");
  if (!isFormat(format)) return NextResponse.json({ error: "Pick a format." }, { status: 400 });
  const order = await prisma.codePrintOrder.findUnique({ where: { id: params.id }, select: { id: true, items: true, artistName: true } });
  if (!order) return NextResponse.json({ error: "That order doesn't exist." }, { status: 404 });
  const items = orderItems(order.items).filter((i) => i.format === format);
  if (!items.length) return NextResponse.json({ error: `No ${FORMATS[format].name.toLowerCase()}s in this order.` }, { status: 404 });
  const no = codeOrderNumber(order.id);
  try {
    const pdf = await generateMixedQrPdf(
      items.map((i) => ({ qty: i.qty, job: { design: { ...sanitizeDesign(i.design), format }, art: i.art as ArtInfo, qrText: i.qrText } })),
      format,
      { title: `${no} · ${FORMATS[format].name} · ${order.artistName || ""}`.trim(), footer: no },
    );
    await logAdminAction(admin, "code_order.pdf", { type: "code_order", id: order.id }, `${no}: downloaded the ${FORMATS[format].name.toLowerCase()} PDF`);
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: pdfHeaders(`${no}-${format}.pdf`, req.nextUrl.searchParams.get("inline") ? "inline" : "attachment") });
  } catch (e) {
    console.error("[code-orders] pdf failed", e);
    return NextResponse.json({ error: "Couldn't make the PDF. Try again." }, { status: 500 });
  }
}
