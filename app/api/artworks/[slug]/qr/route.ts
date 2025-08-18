import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { PrismaClient } from '@prisma/client'
import { generateQrPdf } from '@/lib/generateQrPdf'

export const runtime = 'nodejs'

const prisma = new PrismaClient()

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    if (!slug) return new NextResponse('Missing slug', { status: 400 })

    // Auth
    const token = req.cookies.get('auth-token')?.value
    if (!token) return new NextResponse('Not authenticated', { status: 401 })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)

    // Try common fields where your artist id might live
    const requesterArtistId =
      (payload as any).artistId ||
      (payload as any).id ||
      (payload as any).sub

    if (!requesterArtistId) {
      return new NextResponse('Invalid token payload', { status: 401 })
    }

    // Fetch artwork + owner + display fields
    const artwork = await prisma.artwork.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        artistId: true,
        artist: { select: { name: true } },
      },
    })

    if (!artwork) return new NextResponse('Artwork not found', { status: 404 })

    // Ownership check
    if (artwork.artistId !== requesterArtistId) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    // Build absolute URL to /art/[slug]
    const host =
      req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const proto =
      req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const base =
      process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`
    const url = `${base}/art/${artwork.slug}`

    // Generate PDF buffer
    const pdf = await generateQrPdf({
      title: artwork.title,
      artistName: artwork.artist?.name || '',
      url,
    })

    // Return as download
    const mode =
    new URL(req.url).searchParams.get('download') === '1'
        ? 'attachment'
        : 'inline'

    // Buffer → Uint8Array (Buffer is a Uint8Array subclass)
    const body = new Uint8Array(pdf)

    return new NextResponse(body, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${mode}; filename="${artwork.slug}-qr-card.pdf"`,
            'Cache-Control': 'no-store',
        },
    })


  } catch (err) {
    console.error('QR route error', err)
    return new NextResponse('Server error', { status: 500 })
  }
}
