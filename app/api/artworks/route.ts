import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";


export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1)
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "12", 10), 1), 48)
        const skip = (page - 1) * limit

        const [artworks, total] = await Promise.all([
            prisma.artwork.findMany({
                skip,
                take: limit,
                orderBy: { id: "desc" },
                include: { artist: { select: { name: true, slug: true } } },
            }),
            prisma.artwork.count({

                }),
            ]);

        return NextResponse.json({ artworks, total }, { status: 200 });


    } catch (err) {
        console.error("api Error fetching all arts: ", err)
        return new NextResponse('Server Error', { status: 500 })
    }
}