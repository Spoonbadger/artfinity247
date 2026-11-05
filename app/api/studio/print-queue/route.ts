// The print queue (/studio/qr/queue), saved per artist so it follows them across devices.
//   GET                                          → { items, cards }
//   POST { slug, design, code?, qty }            QR Studio: this piece, this look, its saved code (made if missing)
//   POST { slugs: string[], look?, qty? }        My art / after upload: each piece's plain code, in a preset look
//                                                ("gallery" | "sticker" | "market" | "poster"), a format, or the last-used look
//   POST { all: true, look? }                    every live or in-review piece
// Adding the same code in the same format again adds to its quantity. → { added, cards }
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureArtworkCode, normalizeCode } from "@/lib/shortlinks";
import { FORMATS, sanitizeDesign } from "@/components/qr/card";
import { addPieces, addToQueue, clampQty, loadQueue, plainDesign, queueCount } from "@/lib/printQueue";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const err = (error: string, code: string, status: number) => NextResponse.json({ error, code }, { status });

export async function GET() {
  const user = await getUserFromCookie();
  if (!user?.id) return err("Log in to see your print queue.", "not_logged_in", 401);
  const rows = await loadQueue(user.id);
  return NextResponse.json({
    items: rows.map((r) => ({ id: r.id, format: r.format, qty: r.qty, code: r.qrCode.code, title: r.artwork.title, slug: r.artwork.slug })),
    cards: rows.reduce((n, r) => n + r.qty, 0),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return err("Log in to add codes to your print queue.", "not_logged_in", 401);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return err("Something was missing from that request. Refresh and try again.", "bad_request", 400);

  try {
    if (body.all === true || Array.isArray(body.slugs)) {
      const slugs = body.all === true ? "all" : (body.slugs as unknown[]).filter((s): s is string => typeof s === "string").slice(0, 200);
      if (slugs !== "all" && !slugs.length) return err("Pick at least one piece.", "missing_art", 400);
      const { added, design } = await addPieces(user.id, slugs, body.look, clampQty(body.qty));
      if (!added) return slugs === "all" ? err("No pieces to add yet. Upload art and its code can go in the queue.", "no_art_yet", 404) : err("We couldn't find those pieces. They may be rejected or deleted.", "art_not_found", 404);
      return NextResponse.json({ added, format: design.format, formatName: FORMATS[design.format].name, cards: await queueCount(user.id) });
    }

    const slug = typeof body.slug === "string" ? body.slug : "";
    if (!slug) return err("Pick a piece first.", "missing_art", 400);
    const art = await prisma.artwork.findFirst({ where: { slug, artistId: user.id, status: { in: ["APPROVED", "PENDING"] } }, select: { id: true, title: true } });
    if (!art) return err("We couldn't find that piece. It may have been deleted.", "art_not_found", 404);
    let design = sanitizeDesign(body.design);
    const qty = clampQty(body.qty);
    let qrCodeId: string | null = null;
    const code = normalizeCode(body.code);
    if (code) {
      const qr = await prisma.qrCode.findFirst({ where: { code, artistId: user.id }, select: { id: true, artworkId: true } });
      if (!qr) return err("We couldn't find that code.", "code_not_found", 404);
      if (qr.artworkId !== art.id) return err("That code opens a different piece. Save this piece's code first.", "code_not_found", 400);
      qrCodeId = qr.id;
    } else {
      // No saved code yet: the piece's plain code (no venue or discount), so the card mustn't promise one.
      design = plainDesign(design);
      const c = await ensureArtworkCode(user.id, art.id, `${art.title} · ${FORMATS[design.format].name}`, design);
      qrCodeId = (await prisma.qrCode.findUnique({ where: { code: c }, select: { id: true } }))?.id ?? null;
    }
    if (!qrCodeId) return err("Couldn't make a code just now. Try again.", "server_error", 500);
    await addToQueue(user.id, { artworkId: art.id, qrCodeId, design, qty });
    return NextResponse.json({ added: 1, format: design.format, formatName: FORMATS[design.format].name, cards: await queueCount(user.id) });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "queue_full") return err((e as Error).message, "queue_full", 409);
    console.error("[print-queue] add failed", e);
    return err("Couldn't add to your print queue. Try again.", "server_error", 500);
  }
}
