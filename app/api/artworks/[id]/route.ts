import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getUserFromRequest } from '@/lib/auth'

const prisma = new PrismaClient()

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const artwork = await prisma.artwork.findUnique({
        where: { id: params.id }
    })

    if (!artwork || artwork.artistId !== user.id) {
        return NextResponse.json({ error: 'Forbidden'}, { status: 403} )
    }

    await prisma.artwork.delete({
        where: { id: params.id }
    })

    return NextResponse.json({ success: true })
}