// POST /api/qr/codes {artworkSlug?, label?, venue?, discountPct?, expiresAt?, design?} → {id, code}
// Makes a short link code for the logged-in artist. QR Studio calls it on the first download or "Save code".
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie } from "@/lib/auth";
import { createQrCode } from "@/lib/shortlinks";
import { parseMeta } from "./meta";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUserFromCookie();
  if (!user?.id) return NextResponse.json({ error: "Log in to keep going.", code: "not_logged_in" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Something was missing from that request. Refresh and try again.", code: "bad_request" }, { status: 400 });
  const meta = await parseMeta(body, user.id);
  if (typeof meta === "string") return NextResponse.json({ error: meta, code: "invalid_code_settings" }, { status: 400 });
  try {
    const { active: _ignored, ...fields } = meta; // new codes start active
    const row = await createQrCode({ artistId: user.id, ...fields });
    return NextResponse.json({ id: row.id, code: row.code });
  } catch (e) {
    console.error("[qr/codes] create failed", e);
    return NextResponse.json({ error: "Couldn't make a code just now. Try again.", code: "server_error" }, { status: 500 });
  }
}
