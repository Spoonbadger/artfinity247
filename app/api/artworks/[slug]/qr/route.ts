// GET → a print sheet of gallery-label QR cards for one artwork.
// Auth: the logged-in artist (or an admin), or the 7-day email token from the "artwork is live" email.
import { ensureArtworkCode, shortUrl } from "@/lib/shortlinks";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard, verifyLinkToken } from "@/lib/auth";
import { accountState, gateResponse } from "@/lib/accountGate";
import { generateQrPdf } from "@/lib/generateQrPdf";
import { DEFAULT_DESIGN } from "@/components/qr/card";
import { baseUrl, findArt, pdfHeaders, toArtInfo } from "@/app/api/qr/art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { slug } = params;
  if (!slug) return NextResponse.json({ error: "Pick a piece first.", code: "missing_art" }, { status: 400 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  let payload: Record<string, unknown>;
  if (token) {
    // Emailed download links carry their own signed token (lib/artworkLive.ts).
    const link = await verifyLinkToken(token);
    if (!link) return NextResponse.json({ error: "That download link expired. Open the piece in Studio and download again.", code: "link_expired" }, { status: 401 });
    payload = link;
  } else {
    // Otherwise the session: signed in, still valid, and not paused or closed (this can create the piece's code).
    const { user, denied } = await activeUserGuard("Log in to keep going.");
    if (denied) return denied;
    payload = user;
  }

  const row = await findArt(slug);
  if (!row?.slug) return NextResponse.json({ error: "We couldn't find that piece. It may have been deleted.", code: "art_not_found" }, { status: 404 });

  if (token) {
    // Email token: signed with { slug, artistId, role, type: "qr_download" } in lib/artworkLive.ts.
    if (payload.type !== "qr_download" || payload.slug !== slug) return NextResponse.json({ error: "That download link expired. Open the piece in Studio and download again.", code: "link_expired" }, { status: 403 });
    if (payload.role !== "ADMIN" && payload.artistId !== row.artistId) return NextResponse.json({ error: "That piece isn't yours.", code: "not_your_art" }, { status: 403 });
    // The link outlives a pause or a closed account, so check the owner's account now.
    const owner = await prisma.artist.findUnique({ where: { id: row.artistId }, select: { closedAt: true, suspendedAt: true } });
    const gate = gateResponse(owner ? accountState(owner) : null);
    if (gate) return NextResponse.json(gate.body, { status: gate.status });
  } else if (payload.role !== "ADMIN" && payload.id !== row.artistId) {
    return NextResponse.json({ error: "That piece isn't yours.", code: "not_your_art" }, { status: 403 });
  }

  try {
    const art = toArtInfo(row);
    const design = { ...DEFAULT_DESIGN, disc: 0, coupon: "" };
    // Every printed code is a short link; this one is reused each time the PDF is opened.
    const code = await ensureArtworkCode(row.artistId, row.id, `${art.title} · Wall label`, design);
    const pdf = await generateQrPdf([{ design, art, qrText: shortUrl(code, baseUrl(req)) }], { fill: true });
    const mode = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: pdfHeaders(`${art.slug}-qr-cards.pdf`, mode) });
  } catch (err) {
    console.error("QR route error", err);
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
