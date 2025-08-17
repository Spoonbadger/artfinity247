import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import slugify from 'slugify'


const prisma = new PrismaClient()

export async function POST(req: Request) {
    const body = await req.json()
    const { name, email, password, city, state, country, phone, profileImage } = body
    const slug = slugify(name, { lower: true })

    if (!name || !email || !password) {
        return new Response('Missing required fields', { status: 400 })
    }
    
    const existing = await prisma.artist.findUnique({ where: { email }})
    if (existing) {
        return new Response('Email already in use', { status: 409 })
    }

    const hashed = await hash(password, 10)

    const artist = await prisma.artist.create({
        data: {
            name,
            email,
            password: hashed,
            city,
            state,
            country,
            phone,
            profileImage,
            slug
        },
    })
    const token = await new SignJWT({ id: artist.id, slug: artist.slug, email: artist.email })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .sign(new TextEncoder().encode(process.env.JWT_SECRET!))

    cookies().set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7
    })

    return Response.json({ 
        artist: { slug: artist.slug }}, 
        { status: 201 })
}