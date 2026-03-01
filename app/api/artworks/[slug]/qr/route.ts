import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from "@/lib/prisma";
import { generateQrPdf } from '@/lib/generateQrPdf'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    if (!slug) return new NextResponse("Missing slug", { status: 400 })

    // Get token
    const token = new URL(req.url).searchParams.get("token")
    let payload: any = null

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

    if (token) {
      const verified = await jwtVerify(token, secret)
      payload = verified.payload
    } else {
      // fallback to auth cookie
      const authToken = req.cookies.get("auth-token")?.value
      if (!authToken) return new NextResponse("Unauthorized", { status: 401 })

      const verified = await jwtVerify(authToken, secret)
      payload = verified.payload
    }

    // Fetch artwork
    const artwork = await prisma.artwork.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        artistId: true,
        artist: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!artwork) return new NextResponse("Artwork not found", { status: 404 })

    // ===== ACCESS CONTROL =====
    if (token) {
      // Email token flow
      if (payload.slug !== slug) {
        return new NextResponse("Invalid token", { status: 403 })
      }

      if (payload.type !== "qr_download") {
        return new NextResponse("Invalid token type", { status: 403 })
      }

      if (
        payload.role !== "ADMIN" &&
        payload.artistId !== artwork.artistId
      ) {
        return new NextResponse("Forbidden", { status: 403 })
      }
    } else {
      // Logged-in flow
      if (
        payload.role !== "ADMIN" &&
        payload.id !== artwork.artistId
      ) {
        return new NextResponse("Forbidden", { status: 403 })
      }
    }

    if (
      payload.role !== "ADMIN" &&
      payload.artistId !== artwork.artistId
    ) {
      return new NextResponse("Forbidden", { status: 403 })
    }


    // Build absolute URL to /art/[slug] with UTM tracking
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

    if (!artwork.slug) {
        return new NextResponse('Artwork has no slug', { status: 500 })
    }
    const artSlug = artwork.slug

    const urlObj = new URL(`${base}/art/${artwork.slug}`)
    urlObj.searchParams.set('utm_source', 'qr')
    urlObj.searchParams.set('utm_medium', 'print')
    urlObj.searchParams.set('utm_campaign', artSlug)
    const url = urlObj.toString()


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
