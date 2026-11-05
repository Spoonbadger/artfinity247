import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { verifyAuthTokenOrThrow } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) return NextResponse.json({ error: "Log in first.", code: "not_logged_in" }, { status: 401 });

    const payload = await verifyAuthTokenOrThrow(token); // signature, expiry and session version

    const artistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;
    if (!artistId) return NextResponse.json({ error: "Your session ended. Log in again.", code: "not_logged_in" }, { status: 401 });

    const { name } = await req.json();
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
      return NextResponse.json({ error: "Your name needs at least 2 letters.", code: "invalid_input" }, { status: 400 });
    }

    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      // artist_name is what public pages show; name is the legacy copy. The slug (@handle) stays put.
      data: { name: name.trim(), artist_name: name.trim() },
      select: { slug: true, name: true, artist_name: true },
    });

    return NextResponse.json({ artist }, { status: 200 });
  } catch (err) {
    console.error("POST /api/artists/update-name failed", err);
    return NextResponse.json({ error: "Couldn't save. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}