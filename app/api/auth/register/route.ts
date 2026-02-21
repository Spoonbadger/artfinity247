import { prisma } from "@/lib/prisma";
import { hash } from 'bcryptjs'
import { SignJWT } from 'jose'
import { cookies } from 'next/headers'
import slugify from 'slugify'
import { Resend } from "resend";
import NewArtistNotificationEmail from "@/emails/NewArtistNotificationEmail"
import WelcomeArtistEmail from "@/emails/WelcomeArtistEmail"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
    const body = await req.json()
    const { 
        name, 
        first_name, 
        last_name, 
        artist_name, 
        email, 
        password, 
        city, 
        state, 
        country, 
        phone, 
        profileImage
     } = body
    const slug = slugify(name, { lower: true })

    if (!name || !email || !password) {
        return new Response('Missing required fields', { status: 400 })
    }
    
    const existing = await prisma.artist.findUnique({ where: { email }})
    if (existing) {
        return new Response('Email already in use', { status: 409 })
    }

    const hashed = await hash(password, 10)

    const citySlug = slugify(city || '', { lower: true, strict: true })

    const artist = await prisma.artist.create({
        data: {
            name,
            first_name: first_name,
            last_name: last_name,
            artist_name: artist_name,
            email,
            password: hashed,
            city,
            citySlug,
            state,
            country,
            phone,
            profileImage,
            slug,
            role: "USER",
        },
    })
    const token = await new SignJWT({ 
        id: artist.id, 
        slug: artist.slug, 
        email: artist.email,
        role: artist.role
    })
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

    await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: "contact@theartfinity.com",
        subject: `New Artist Registration – ${artist_name}`,
        react: NewArtistNotificationEmail({
            artistName: artist_name,
            email,
            city,
            state,
            createdAt: new Date().toLocaleString(),
        }),
    })

    await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: email,
        subject: "Welcome to Artfinity",
        react: WelcomeArtistEmail({
            artistName: artist_name,
        }),
    })


    return Response.json({ 
        artist: { slug: artist.slug }}, 
        { status: 201 })
}