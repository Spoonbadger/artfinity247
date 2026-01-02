import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth-token")?.value ?? null;

  if (!token) return NextResponse.json({ user: null });

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    );

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

