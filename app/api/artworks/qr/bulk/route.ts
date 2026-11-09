// GET → gallery-label QR cards for all of the logged-in artist's approved artworks (or ?slugs=a,b),
// 10 per US Letter sheet with crop marks.
import { ensureArtworkCode, shortUrl } from "@/lib/shortlinks";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { generateQrPdf } from "@/lib/generateQrPdf";
import { DEFAULT_DESIGN } from "@/components/qr/card";
import { artSelect, baseUrl, pdfHeaders, toArtInfo } from "@/app/api/qr/art";
import { recordPrints, type PrintRecord } from "@/lib/labelStatus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });

  const url = new URL(req.url);
  const slugs = url.searchParams.get("slugs")?.split(",").map((s) => s.trim()).filter(Boolean);
  const rows = await prisma.artwork.findMany({
    where: { artistId: user.id, status: "APPROVED", slug: slugs?.length ? { in: slugs } : { not: null } },
    select: { ...artSelect, id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!rows.length) return NextResponse.json({ error: "No live pieces yet. Codes print once your art is approved.", code: "no_approved_art" }, { status: 404 });

  try {
    const base = baseUrl(req);
    const design = { ...DEFAULT_DESIGN, disc: 0, coupon: "" };
    // Every printed code is a short link; each artwork's plain code is reused, not made again.
    const jobs = [];
    const printed: PrintRecord[] = [];
    for (const r of rows) {
      const art = toArtInfo(r);
      const code = await ensureArtworkCode(user.id, r.id, `${art.title} · Wall label`, design);
      jobs.push({ design, art, qrText: shortUrl(code, base) });
      const qr = await prisma.qrCode.findUnique({ where: { code }, select: { id: true } });
      if (qr) printed.push({ qrCodeId: qr.id, artistId: user.id, artworkId: r.id, design, art, qty: 1, source: "print_all" });
    }
    const pdf = await generateQrPdf(jobs);
    await recordPrints(printed); // what each printed card says (lib/labelStatus.ts)
    const mode = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: pdfHeaders(`artfinity-qr-cards-${stamp}.pdf`, mode) });
  } catch (err) {
    console.error("Bulk QR PDF error", err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
