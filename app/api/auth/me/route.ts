import { NextRequest, NextResponse } from "next/server"
import { verifyAuthToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value ?? null;

  if (!token) return NextResponse.json({ user: null });

  try {
    // Bad, expired or signed-out (old sessionVersion) tokens, and closed or suspended accounts, count as logged out.
    const payload = await verifyAuthToken(token);
    const row = payload ? await prisma.artist.findUnique({ where: { id: payload.id }, select: { closedAt: true, suspendedAt: true, role: true } }) : null;
    if (!payload || !row || row.closedAt || row.suspendedAt) {
      const res = NextResponse.json({ user: null });
      res.cookies.set("auth-token", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      return res;
    }

    return NextResponse.json({
      user: {
        id: payload.id,
        slug: payload.slug,
        email: payload.email,
        role: row.role,
      },
    });
  } catch (err) {
    console.error("JWT VERIFY FAILED:", err);
    return NextResponse.json({ user: null });
  }
}

