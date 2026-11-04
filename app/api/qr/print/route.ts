// POST { slug, design } → a US Letter print sheet (PDF) of the designed card, with crop marks.
// POST { all: true, design } → one card per approved artwork of the logged-in artist, same look, as many sheets as needed.
import { signedQrValue } from "@/lib/scanSign";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { generateQrPdf } from "@/lib/generateQrPdf";
import { qrValue, sanitizeDesign } from "@/components/qr/card";
import { artSelect, baseUrl, findArt, pdfHeaders, toArtInfo } from "../art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return new NextResponse("Log in to print codes", { status: 401 });

  const body = (await req.json().catch(() => null)) as { slug?: unknown; design?: unknown; all?: unknown } | null;

  if (body?.all === true) {
    const rows = await prisma.artwork.findMany({
      where: { artistId: user.id, status: "APPROVED", slug: { not: null } },
      select: artSelect,
      orderBy: { createdAt: "desc" },
    });
    if (!rows.length) return new NextResponse("No approved artworks yet", { status: 404 });
    try {
      const design = sanitizeDesign(body.design);
      const base = baseUrl(req);
      const pdf = await generateQrPdf(await Promise.all(rows.map(async (r) => {
        const art = toArtInfo(r);
        return { design, art, qrText: await signedQrValue(design, art.slug, base) };
      })));
      return new NextResponse(Buffer.from(pdf), { status: 200, headers: pdfHeaders(`artfinity-all-codes-${design.format}.pdf`) });
    } catch (err) {
      console.error("QR print-all error", err);
      return new NextResponse("Could not make the PDF", { status: 500 });
    }
  }

  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!slug) return new NextResponse("Missing slug", { status: 400 });

  const row = await findArt(slug);
  if (!row?.slug) return new NextResponse("Artwork not found", { status: 404 });
  if (row.artistId !== user.id && user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });

  try {
    const design = sanitizeDesign(body?.design);
    const art = toArtInfo(row);
    const pdf = await generateQrPdf([{ design, art, qrText: await signedQrValue(design, art.slug, baseUrl(req)) }], { fill: true });
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: pdfHeaders(`${art.slug}-${design.format}-sheet.pdf`) });
  } catch (err) {
    console.error("QR print error", err);
    return new NextResponse("Could not make the PDF", { status: 500 });
  }
}
