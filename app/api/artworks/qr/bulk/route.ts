// GET → gallery-label QR cards for all of the logged-in artist's approved artworks (or ?slugs=a,b),
// 10 per US Letter sheet with crop marks.
import { signedQrValue } from "@/lib/scanSign";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { generateQrPdf } from "@/lib/generateQrPdf";
import { DEFAULT_DESIGN, qrValue } from "@/components/qr/card";
import { artSelect, baseUrl, pdfHeaders, toArtInfo } from "@/app/api/qr/art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return new NextResponse("Not authenticated", { status: 401 });

  const url = new URL(req.url);
  const slugs = url.searchParams.get("slugs")?.split(",").map((s) => s.trim()).filter(Boolean);
  const rows = await prisma.artwork.findMany({
    where: { artistId: user.id, status: "APPROVED", slug: slugs?.length ? { in: slugs } : { not: null } },
    select: artSelect,
    orderBy: { createdAt: "desc" },
  });
  if (!rows.length) return new NextResponse("No artworks found", { status: 404 });

  try {
    const base = baseUrl(req);
    const design = { ...DEFAULT_DESIGN, disc: 0, coupon: "" };
    const pdf = await generateQrPdf(await Promise.all(rows.map(async (r) => {
      const art = toArtInfo(r);
      return { design, art, qrText: await signedQrValue(design, art.slug, base) };
    })));
    const mode = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: pdfHeaders(`artfinity-qr-cards-${stamp}.pdf`, mode) });
  } catch (err) {
    console.error("Bulk QR PDF error", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
