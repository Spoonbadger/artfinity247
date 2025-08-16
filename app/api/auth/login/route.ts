import { PrismaClient } from '@prisma/client'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

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

    const token = await new SignJWT({ id: artist.id, email: artist.email, slug: artist.slug })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    const response = NextResponse.json({
      message: 'Logged in',
      token,
      artist: { 
        id: artist.id,
        name: artist.name,
        slug: artist.slug,
        email: artist.email,
      } 
    })

    const cookieBase = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const
    }

    if (remember) {
      response.cookies.set('auth-token', token, { ...cookieBase, maxAge: 60 * 60 * 24 * 30 }) // 30d
    } else {
      response.cookies.set('auth-token', token, cookieBase) // session cookie
    }

    return response
  } catch (err) {
    console.error(err)
    return new Response('Login Failed', { status: 500 })
  }
}