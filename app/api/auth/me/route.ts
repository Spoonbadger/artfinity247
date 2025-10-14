import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("authorization")?.split(" ")[1] ??
    req.cookies.get("auth-token")?.value ??
    null

  if (!token) return NextResponse.json({ user: null })

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )
    return NextResponse.json({
      user: {
        id: payload.id,
        slug: payload.slug,
        email: payload.email,
        role: payload.role,
      },
    })
  } catch {
    return NextResponse.json({ user: null })
  }
}
