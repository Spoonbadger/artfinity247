import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value ?? null;

  if (!token) return NextResponse.json({ user: null });

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

    // A closed account counts as logged out; clear its cookie.
    const row = await prisma.artist.findUnique({ where: { id: String(payload.id || "") }, select: { closedAt: true } });
    if (!row || row.closedAt) {
      const res = NextResponse.json({ user: null });
      res.cookies.set("auth-token", "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
      return res;
    }

    return NextResponse.json({
      user: {
        id: payload.id,
        slug: payload.slug,
        email: payload.email,
        role: payload.role,
      },
    });
  } catch (err) {
    console.error("JWT VERIFY FAILED:", err);
    return NextResponse.json({ user: null });
  }
}

