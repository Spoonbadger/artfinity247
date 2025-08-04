import { NextRequest, NextResponse} from 'next/server'
import { PrismaClient} from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
    req: NextRequest,
    { params }: { params: { slug: string } }
) {
    const { slug } = params

    const artist = await prisma.artist.findUnique({
        where: { slug },
        select: { id: true },
    })

    const { searchParams } = new URL(req.url)
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1')
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '12')
    const skip = (page -1) * limit

    if (!artist) return new NextResponse('Artist not found', { status: 404 })

    const [artworks, total] = await Promise.all([
        prisma.artwork.findMany({
            where: { artistId: artist.id },
            orderBy: { createdAt: 'desc'},
            skip,
            take: limit,
        }),
        prisma.artwork.count({ where: { artistId: artist.id }})
    ])

    return NextResponse.json({ artworks, total })
}