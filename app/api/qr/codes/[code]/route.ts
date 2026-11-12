// PATCH /api/qr/codes/<CODE> {artworkId|artworkSlug, label, venue, discountPct, expiresAt, active, design}
// Edits what's behind a printed code. Only the code's artist (or an admin) can change it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from "@/lib/auth";
import { normalizeCode } from "@/lib/shortcode";
import { parseMeta } from "../meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const { user, denied } = await activeUserGuard("Log in to keep going.");
  if (denied) return denied;
  const code = normalizeCode(params.code);
  const row = code ? await prisma.qrCode.findUnique({ where: { code }, select: { id: true, artistId: true } }) : null;
  if (!row) return NextResponse.json({ error: "We couldn't find that code.", code: "code_not_found" }, { status: 404 });
  if (row.artistId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "That isn't yours to change.", code: "not_your_art" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Something was missing from that request. Refresh and try again.", code: "bad_request" }, { status: 400 });
  const meta = await parseMeta(body, row.artistId);
  if (typeof meta === "string") return NextResponse.json({ error: meta, code: "invalid_code_settings" }, { status: 400 });

  try {
    const updated = await prisma.qrCode.update({
      where: { id: row.id },
      data: { ...meta, design: meta.design as never },
      select: { code: true, artworkId: true, label: true, venue: true, discountPct: true, expiresAt: true, active: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[qr/codes] update failed", e);
    return NextResponse.json({ error: "Couldn't save the code just now. Try again.", code: "server_error" }, { status: 500 });
  }
}
