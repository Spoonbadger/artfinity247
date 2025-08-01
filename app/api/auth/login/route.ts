import { PrismaClient } from '@prisma/client'
import { compare } from 'bcryptjs'
import { SignJWT } from 'jose'
import { NextResponse } from 'next/server'

const prisma = new PrismaClient()

export async function POST(req: Request) {
  try {  
    const { email, password } = await req.json()
    const artist = await prisma.artist.findUnique({ where: { email }})

    if (!artist || !artist.password ) {
        return new NextResponse('Invalid credentials', { status: 401 })
    }

    const isValid = await compare(password, artist.password)

    if (!isValid) {
        return new NextResponse('Invalid credentials', { status: 401})
    }

    const token = await new SignJWT({ id: artist.id, email: artist.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    const response = NextResponse.json({ message: 'Logged in', artist: { id: artist.id, name: artist.name, email: artist.email } })
    response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7
    })

    return response
  } catch (err) {
    console.error(err)
    return new Response('Login Failed', { status: 500 })
  }
}