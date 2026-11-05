import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ error: "The photo didn't upload. Try another one.", code: "invalid_input" }, { status: 400 });

    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      data: { profileImage: imageUrl },
      select: { slug: true, profileImage: true },
    });

    return NextResponse.json({ artist });
  } catch (err) {
    console.error("Update profile image failed:", err);
    return NextResponse.json({ error: "Couldn't save. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
