// PATCH /api/qr/codes/<CODE> {artworkId|artworkSlug, label, venue, discountPct, expiresAt, active, design}
// Edits what's behind a printed code. Only the code's artist (or an admin) can change it.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromCookie } from "@/lib/auth";
import { normalizeCode } from "@/lib/shortcode";
import { parseMeta } from "../meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: { code: string } }) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const code = normalizeCode(params.code);
  const row = code ? await prisma.qrCode.findUnique({ where: { code }, select: { id: true, artistId: true } }) : null;
  if (!row) return NextResponse.json({ error: "Code not found" }, { status: 404 });
  if (row.artistId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const meta = await parseMeta(body, row.artistId);
  if (typeof meta === "string") return NextResponse.json({ error: meta }, { status: 400 });

  const updated = await prisma.qrCode.update({
    where: { id: row.id },
    data: { ...meta, design: meta.design as never },
    select: { code: true, artworkId: true, label: true, venue: true, discountPct: true, expiresAt: true, active: true },
  });
  return NextResponse.json(updated);
}
