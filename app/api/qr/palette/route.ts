// GET /api/qr/palette?slug=<artwork> → { palette: ["#e0bd69", …], accent: "#897440" | null } for Match your art:
// up to 3 colours from the piece's public preview, and the one the pill or panel uses (white text on it reads at
// 4.5:1 or more). The artist's own pieces only.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { artPalette } from "@/lib/qr/palette";
import { findArt } from "../art";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const row = slug ? await findArt(slug) : null;
  if (!row?.slug) return NextResponse.json({ error: "We couldn't find that piece.", code: "art_not_found" }, { status: 404 });
  if (row.artistId !== user.id && user.role !== "ADMIN") return NextResponse.json({ error: "That piece isn't yours.", code: "not_your_art" }, { status: 403 });
  const p = await artPalette(row.imageUrl);
  if (!p) return NextResponse.json({ error: "We couldn't read the colours of that image.", code: "image_unreadable" }, { status: 422 });
  return NextResponse.json(p, { headers: { "Cache-Control": "private, max-age=3600" } });
}
