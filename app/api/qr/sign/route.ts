// POST /api/qr/sign {slug, disc, ev} → {sig}
// Signs a scan discount for the QR Studio preview. Only the artwork's artist (or an admin) can sign.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { signScan } from "@/lib/scanSign";
import { findArt } from "../art";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const disc = Number(body?.disc);
  const ev = typeof body?.ev === "string" ? body.ev.trim().slice(0, 60) : "";
  if (!slug || !Number.isInteger(disc) || disc < 5 || disc > 30) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const row = await findArt(slug);
  if (!row?.slug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (row.artistId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ sig: signScan(row.slug, disc, ev || null) });
}
