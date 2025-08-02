import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(req: Request) {
    const body = await req.json()
    const { name, email, password, city, state, country, phone, profileImage } = body

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
        },
    })
    return Response.json({ success: true, artistId: artist.id })
}