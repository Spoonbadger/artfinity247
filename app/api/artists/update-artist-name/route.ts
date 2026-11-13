import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { activeUserGuard } from "@/lib/auth";
import { OFFENSIVE_NAME_MESSAGE, isOffensiveName } from "@/lib/trust/names";

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const { user, denied } = await activeUserGuard(); // signed in, session still valid, account not paused or closed
    if (denied) return denied;
    const artistId = user.id;

    const { name } = await req.json();
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 80) {
      return NextResponse.json({ error: "Your name needs at least 2 letters.", code: "invalid_input" }, { status: 400 });
    }
    if (isOffensiveName(name)) {
      return NextResponse.json({ error: OFFENSIVE_NAME_MESSAGE, code: "offensive_name" }, { status: 400 });
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