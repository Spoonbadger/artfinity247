
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

import { verifyAuthTokenOrThrow } from "@/lib/auth";

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const payload = await verifyAuthTokenOrThrow(token); // signature, expiry and session version

    const artistId = payload.id as string

    if (!artistId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const artwork = await prisma.artwork.findFirst({
      where: { artistId },
      orderBy: { createdAt: "desc" },
      select: {
        markupSmall: true,
        markupMedium: true,
        markupLarge: true,
        markupXl: true,
      },
    })

    return NextResponse.json(artwork)
  } catch (err) {
    console.error("Last prices error:", err)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
