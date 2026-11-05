// GET /api/studio/print-queue/pdf?format=label → the queue's cards in that format as one PDF, different pieces packed
// onto the same US Letter sheets (generateMixedQrPdf). Nothing is made or changed: every item already has its code.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { generateMixedQrPdf } from "@/lib/generateQrPdf";
import { FORMATS } from "@/components/qr/card";
import { isFormat, jobsByFormat, loadQueue } from "@/lib/printQueue";
import { baseUrl, pdfHeaders } from "../../../qr/art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to print your queue.", code: "not_logged_in" }, { status: 401 });
  const format = req.nextUrl.searchParams.get("format");
  if (!isFormat(format)) return NextResponse.json({ error: "Pick a format to print.", code: "bad_request" }, { status: 400 });
  const groups = jobsByFormat(await loadQueue(user.id), baseUrl(req));
  const list = groups.get(format) || [];
  if (!list.length) return NextResponse.json({ error: `No ${FORMATS[format].name.toLowerCase()}s in your queue.`, code: "queue_empty" }, { status: 404 });
  try {
    const pdf = await generateMixedQrPdf(list.map((g) => ({ job: g.job, qty: g.qty })), format, { title: `Artfinity print queue · ${FORMATS[format].name}` });
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: { ...pdfHeaders(`artfinity-queue-${format}.pdf`), "X-Af-Cards": String(list.reduce((n, g) => n + g.qty, 0)) } });
  } catch (e) {
    console.error("[print-queue] pdf failed", e);
    return NextResponse.json({ error: "Couldn't make the PDF. Try again.", code: "server_error" }, { status: 500 });
  }
}
