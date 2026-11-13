// POST /api/studio/code-prints { code, design } → records a card the browser made for printing (the QR Studio SVG
// download), so its price is remembered (lib/labelStatus.ts). PDFs record themselves on the server. → { recorded }
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { normalizeCode } from "@/lib/shortcode";
import { markupsOf, recordPrints } from "@/lib/labelStatus";
import { body, err } from "../places/_lib";
import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { user, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;
  const artistId = user.id;
  const b = await body(req);
  const code = normalizeCode(b?.code);
  if (!b || !code) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);
  const qr = await prisma.qrCode.findFirst({
    where: { code, artistId },
    select: { id: true, artworkId: true, artwork: { select: { title: true, markupSmall: true, markupMedium: true, markupLarge: true, markupXl: true } } },
  });
  if (!qr) return err("We couldn't find that code.", "code_not_found", 404);
  if (!qr.artwork) return NextResponse.json({ recorded: 0 });
  const recorded = await recordPrints([{ qrCodeId: qr.id, artistId, artworkId: qr.artworkId, design: b.design, art: { title: qr.artwork.title, markups: markupsOf(qr.artwork) }, qty: 1, source: "download" }]);
  return NextResponse.json({ recorded });
}
