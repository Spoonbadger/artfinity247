import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

export async function GET(req: NextRequest) {
  // Try Bearer header first, then fall back to the auth cookie
  const authHeader = req.headers.get('authorization')
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null
  const cookie = req.cookies.get('auth-token')?.value || null
  const token = bearer ?? cookie

  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )
    return NextResponse.json({
      id: payload.id,           // you sign { id, email, slug }
      slug: payload.slug,
      email: payload.email,
    })
  } catch {
    return new NextResponse('Invalid token', { status: 401 })
  }
}