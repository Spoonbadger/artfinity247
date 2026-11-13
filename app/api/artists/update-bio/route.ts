import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

import { activeUserGuard } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { user, denied } = await activeUserGuard(); // signed in, session still valid, account not paused or closed
    if (denied) return denied;
    const artistId = user.id;

    const { bio } = await req.json();
    if (typeof bio !== "string" || bio.length > 1000) {
      return NextResponse.json({ error: "That bio is too long. Two or three lines is plenty.", code: "invalid_input" }, { status: 400 });
    }

    const artist = await prisma.artist.update({
      where: { id: String(artistId) },
      data: { bio: bio.trim() },
      select: { slug: true, bio: true },
    });

    return NextResponse.json({ artist }, { status: 200 });
  } catch (err) {
    console.error("POST /api/artists/update-bio failed", err);
    return NextResponse.json({ error: "Couldn't save. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}