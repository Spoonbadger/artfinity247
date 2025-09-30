import { prisma } from "@/lib/prisma";
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'


export async function POST(req: Request) {
  try {  
    const { email, password, remember = false } = await req.json()
    const artist = await prisma.artist.findUnique({ where: { email }})

    if (!artist || !artist.password ) {
        return new NextResponse('Invalid credentials', { status: 401 })
    }

    const isValid = await compare(password, artist.password)

    if (!isValid) {
        return new NextResponse('Invalid credentials', { status: 401})
    }

    const jwtExpire = remember ? '30d' : '3h'

    const token = await new SignJWT({ id: artist.id, email: artist.email, slug: artist.slug, role: artist.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(jwtExpire)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    const response = NextResponse.json({
      message: 'Logged in',
      // token,
      artist: { 
        id: artist.id,
        name: artist.name,
        slug: artist.slug,
        email: artist.email,
        role: artist.role,
      } 
    })

    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const
    }

    if (remember) {
      response.cookies.set('auth-token', token, remember 
        ? { ...cookieBase, maxAge: 60 * 60 * 24 * 30 } 
        : { ...cookieBase, maxAge: 60*60*3 })
    } else {
      response.cookies.set('auth-token', token, cookieBase) // session cookie
    }

    return response
  } catch (err) {
    console.error(err)
    return new Response('Login Failed', { status: 500 })
  }
}