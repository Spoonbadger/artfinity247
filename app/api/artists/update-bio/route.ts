import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
    const token = req.cookies.get('auth-token')?.value
    if (!token) {
        return new NextResponse('Not authenticated', { status: 401 })
    }

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(process.env.JWT_SECRET!)
        )

        const { bio } = await req.json()

        if (!bio || bio !== 'string') {
            return new NextResponse('invalid bio', { status: 400 })
        }

        await prisma.artist.update({
            where: { id: payload.id as string },
            data: { bio }
        })

    } catch (err) {
        return new NextResponse('Failed to update bio', { status: 401})
    }
}