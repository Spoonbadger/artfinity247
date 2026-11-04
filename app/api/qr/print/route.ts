// POST { slug, design, code } → a US Letter print sheet (PDF) of the designed card, with crop marks.
//   Every card holds a short link (HTTPS://THEARTFINITY.COM/Q/<CODE>). Without a code, one is made for the artwork
//   from { design, label, venue, discountPct, expiresAt }; the code comes back in the X-Af-Code header.
// POST { all: true, design, venue?, discountPct?, expiresAt? } → one new code and one card per approved artwork
//   of the logged-in artist, same look, as many sheets as needed. X-Af-Codes says how many codes were made.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { generateQrPdf } from "@/lib/generateQrPdf";
import { sanitizeDesign, FORMATS } from "@/components/qr/card";
import { createQrCode, normalizeCode, shortUrl } from "@/lib/shortlinks";
import { parseMeta } from "../codes/meta";
import { artSelect, baseUrl, findArt, pdfHeaders, toArtInfo } from "../art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return new NextResponse("Log in to print codes", { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const base = baseUrl(req);

  if (body?.all === true) {
    const rows = await prisma.artwork.findMany({
      where: { artistId: user.id, status: "APPROVED", slug: { not: null } },
      select: { ...artSelect, id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!rows.length) return new NextResponse("No approved artworks yet", { status: 404 });
    const meta = await parseMeta({ venue: body.venue, discountPct: body.discountPct ?? null, expiresAt: body.expiresAt ?? null }, user.id);
    if (typeof meta === "string") return new NextResponse(meta, { status: 400 });
    try {
      const design = sanitizeDesign(body.design);
      const jobs = [];
      for (const r of rows) {
        const art = toArtInfo(r);
        const qr = await createQrCode({
          artistId: user.id, artworkId: r.id, design,
          label: `${r.title}${meta.venue ? ` · ${meta.venue}` : ` · ${FORMATS[design.format].name}`}`.slice(0, 60),
          venue: meta.venue, discountPct: meta.discountPct, expiresAt: meta.expiresAt,
        });
        jobs.push({ design, art, qrText: shortUrl(qr.code, base) });
      }
      const pdf = await generateQrPdf(jobs);
      return new NextResponse(Buffer.from(pdf), { status: 200, headers: { ...pdfHeaders(`artfinity-all-codes-${design.format}.pdf`), "X-Af-Codes": String(jobs.length) } });
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
    let code = normalizeCode(body?.code);
    if (code) {
      const own = await prisma.qrCode.findUnique({ where: { code }, select: { artistId: true } });
      if (!own || (own.artistId !== user.id && user.role !== "ADMIN")) return new NextResponse("Code not found", { status: 404 });
    } else {
      const meta = await parseMeta({ label: body?.label, venue: body?.venue, discountPct: body?.discountPct ?? null, expiresAt: body?.expiresAt ?? null, artworkSlug: row.slug }, row.artistId);
      if (typeof meta === "string") return new NextResponse(meta, { status: 400 });
      const { active: _a, design: _d, ...fields } = meta;
      code = (await createQrCode({ artistId: row.artistId, ...fields, design })).code;
    }
    const pdf = await generateQrPdf([{ design, art, qrText: shortUrl(code, base) }], { fill: true });
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: { ...pdfHeaders(`${art.slug}-${design.format}-sheet.pdf`), "X-Af-Code": code } });
  } catch (err) {
    console.error("QR print error", err);
    return new NextResponse("Could not make the PDF", { status: 500 });
  }
}
