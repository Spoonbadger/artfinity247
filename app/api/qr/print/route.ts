// POST { slug, design, code } → a US Letter print sheet (PDF) of the designed card, with crop marks.
//   Every card holds a short link (HTTPS://THEARTFINITY.COM/Q/<CODE>). Without a code, one is made for the artwork
//   from { design, label, venue, discountPct, expiresAt }; the code comes back in the X-Af-Code header.
// POST { all: true, design, venue?, venueId?, discountPct?, expiresAt? } → one new code and one card per approved artwork
//   of the logged-in artist, same look, as many sheets as needed. X-Af-Codes says how many codes were made.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from "@/lib/auth";
import { generateQrPdf } from "@/lib/generateQrPdf";
import { artistIsPro } from "@/lib/qr/plan";
import { sanitizeDesign, FORMATS } from "@/components/qr/card";
import { createQrCode, normalizeCode, shortUrl } from "@/lib/shortlinks";
import { parseMeta } from "../codes/meta";
import { recordPrints, type PrintRecord } from "@/lib/labelStatus";
import { artSelect, baseUrl, findArt, pdfHeaders, toArtInfo } from "../art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { user, denied } = await activeUserGuard("Log in to print codes.");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const base = baseUrl(req);

  if (body?.all === true) {
    const rows = await prisma.artwork.findMany({
      where: { artistId: user.id, status: "APPROVED", slug: { not: null } },
      select: { ...artSelect, id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!rows.length) return NextResponse.json({ error: "No live pieces yet. Codes for every piece print once your art is approved.", code: "no_approved_art" }, { status: 404 });
    const meta = await parseMeta({ venue: body.venue, venueId: body.venueId ?? null, ...("place" in body ? { place: body.place } : {}), discountPct: body.discountPct ?? null, expiresAt: body.expiresAt ?? null }, user.id);
    if (typeof meta === "string") return NextResponse.json({ error: meta, code: "invalid_code_settings" }, { status: 400 });
    try {
      const design = sanitizeDesign(body.design);
      const jobs = [];
      const printed: PrintRecord[] = [];
      for (const r of rows) {
        const art = toArtInfo(r);
        const qr = await createQrCode({
          artistId: user.id, artworkId: r.id, design,
          label: `${r.title}${meta.venue ? ` · ${meta.venue}` : ` · ${FORMATS[design.format].name}`}`.slice(0, 60),
          venue: meta.venue, venueId: meta.venueId, placeId: meta.placeId, discountPct: meta.discountPct, expiresAt: meta.expiresAt,
        });
        jobs.push({ design, art, qrText: shortUrl(qr.code, base) });
        printed.push({ qrCodeId: qr.id, artistId: user.id, artworkId: r.id, design, art, qty: 1, source: "print_all" as const });
      }
      // A Free artist's Infinity look prints as the closest free look.
      const pdf = await generateQrPdf(jobs, { pro: await artistIsPro(user.id) });
      await recordPrints(printed); // what each printed card says (lib/labelStatus.ts)
      return new NextResponse(Buffer.from(pdf), { status: 200, headers: { ...pdfHeaders(`artfinity-all-codes-${design.format}.pdf`), "X-Af-Codes": String(jobs.length) } });
    } catch (err) {
      console.error("QR print-all error", err);
      return NextResponse.json({ error: "Couldn't make the PDF. Try again.", code: "server_error" }, { status: 500 });
    }
  }

  const slug = typeof body?.slug === "string" ? body.slug : "";
  if (!slug) return NextResponse.json({ error: "Pick a piece first.", code: "missing_art" }, { status: 400 });

  const row = await findArt(slug);
  if (!row?.slug) return NextResponse.json({ error: "We couldn't find that piece. It may have been deleted.", code: "art_not_found" }, { status: 404 });
  if (row.artistId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "That piece isn't yours.", code: "not_your_art" }, { status: 403 });

  try {
    const design = sanitizeDesign(body?.design);
    const art = toArtInfo(row);
    let code = normalizeCode(body?.code);
    if (code) {
      const own = await prisma.qrCode.findUnique({ where: { code }, select: { artistId: true } });
      if (!own || (own.artistId !== user.id && user.role !== "ADMIN")) return NextResponse.json({ error: "We couldn't find that code.", code: "code_not_found" }, { status: 404 });
    } else {
      const meta = await parseMeta({ label: body?.label, venue: body?.venue, venueId: body?.venueId ?? null, ...(body && "place" in body ? { place: body.place } : {}), discountPct: body?.discountPct ?? null, expiresAt: body?.expiresAt ?? null, artworkSlug: row.slug }, row.artistId);
      if (typeof meta === "string") return NextResponse.json({ error: meta, code: "invalid_code_settings" }, { status: 400 });
      const { active: _a, design: _d, ...fields } = meta;
      code = (await createQrCode({ artistId: row.artistId, ...fields, design })).code;
    }
    const pdf = await generateQrPdf([{ design, art, qrText: shortUrl(code, base) }], { fill: true, pro: await artistIsPro(row.artistId) });
    // A full sheet of this card: record what it says (lib/labelStatus.ts).
    const qr = await prisma.qrCode.findUnique({ where: { code }, select: { id: true, artistId: true } });
    if (qr) await recordPrints([{ qrCodeId: qr.id, artistId: qr.artistId, artworkId: row.id, design, art, qty: FORMATS[design.format].sheet.cols * FORMATS[design.format].sheet.rows, source: "download" }]);
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: { ...pdfHeaders(`${art.slug}-${design.format}-sheet.pdf`), "X-Af-Code": code } });
  } catch (err) {
    console.error("QR print error", err);
    return NextResponse.json({ error: "Couldn't make the PDF. Try again.", code: "server_error" }, { status: 500 });
  }
}
