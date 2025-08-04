import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { jwtVerify } from 'jose'
import ArtworkUploadFrom from '@/components/forms/ArtworkUploadForm'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
    const token = req.cookies.get('auth-token')?.value
    if (!token) return new NextResponse('Not authenticated', { status: 401 })
    
    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(process.env.JWT_SECRET!)
        )

        const { title, imageUrl, price } = await req.json()

        if (!title || !imageUrl || !price) {
            return new NextResponse('Missing fields', {status: 400 })
        }

        const newArtwork = await prisma.artwork.create({
            data: {
                title,
                imageUrl,
                price: parseFloat(price),
                artistId: payload.id as string
            }
        })
        return NextResponse.json({ success: true, artwork: newArtwork })

    } catch (err) {
        console.error(err)
        return new NextResponse('upload failed', { status: 500 })
    }
}