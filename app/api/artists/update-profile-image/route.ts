import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { user, denied } = await activeUserGuard(); // signed in, session still valid, account not paused or closed
    if (denied) return denied;
    const artistId = user.id;

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
