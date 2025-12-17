import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { jwtVerify } from 'jose'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

// A4 portrait ~ 595 x 842 pts
const A4 = { w: 595, h: 842 }
// horizontal single card (same as generateQrPdf)
const CARD = { w: 420, h: 210 }
const MARGIN = 24
const GUTTER = 16
const PAD = 20

export async function GET(req: NextRequest) {
  try {
    // Auth
    const token = req.cookies.get('auth-token')?.value
    if (!token) return new NextResponse('Not authenticated', { status: 401 })
    const secret = process.env.JWT_SECRET
    if (!secret) return new NextResponse('JWT_SECRET missing', { status: 500 })
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret))

    const artistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub
    if (!artistId) return new NextResponse('Invalid token', { status: 401 })

    const urlIn = new URL(req.url)
    const layout = (urlIn.searchParams.get('layout') || '1up').toLowerCase() // '1up' | '4up'
    const slugsParam = urlIn.searchParams.get('slugs')
    const slugFilter = slugsParam
      ? slugsParam.split(',').map(s => s.trim()).filter(Boolean)
      : null

    // Fetch artworks
    const rows = await prisma.artwork.findMany({
      where: { artistId, ...(slugFilter ? { slug: { in: slugFilter } } : {}) },
      select: { slug: true, title: true, artist: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const artworks = rows.filter(a => a.slug) as {
      slug: string
      title: string
      artist: { name: string }
    }[]
    if (!artworks.length) return new NextResponse('No artworks found', { status: 404 })

    // Base URL
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const proto =
      req.headers.get('x-forwarded-proto') ||
      (host.startsWith('localhost') ? 'http' : 'https')
    const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

    // Build PDF + fonts
    const pdf = await PDFDocument.create()
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    // Favicon logo
    const faviconPath = path.join(
      process.cwd(),
      'public',
      'favicons',
      'apple-touch-icon.png'
    )
    const faviconBytes = await fs.readFile(faviconPath)
    const faviconImg = await pdf.embedPng(faviconBytes)

    // Card drawer shared by 1up + 4up
    const drawCard = async (
      page: PDFPage,
      box: { x: number; y: number; w: number; h: number },
      art: { slug: string; title: string; artistName: string },
      favicon: any
    ) => {
      const pad = PAD

      // background
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.w,
        height: box.h,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.9, 0.9, 0.9),
        borderWidth: 1,
      })

      // left/right columns (same proportions as single)
      const leftW = box.w * 0.55
      const rightW = box.w - leftW

      // logo
      const logoSize = 40
      const logoX = box.x + pad
      const logoY = box.y + box.h - pad - logoSize

      page.drawImage(favicon, {
        x: logoX,
        y: logoY,
        width: logoSize,
        height: logoSize,
      })

      // title + artist (scaled like single card)
      let textY = logoY - 30

      const titleSize = 18
      page.drawText(art.title, {
        x: box.x + pad,
        y: textY,
        size: titleSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      textY -= titleSize + 4

      const artistSize = 14
      page.drawText(art.artistName, {
        x: box.x + pad,
        y: textY,
        size: artistSize,
        font: fontRegular,
        color: rgb(0.25, 0.25, 0.25),
      })

      // link + QR
      const link = new URL(`${base}/art/${art.slug}`)
      link.searchParams.set('utm_source', 'qr')
      link.searchParams.set('utm_medium', 'print')
      link.searchParams.set('utm_campaign', art.slug)

      const qrPng = await QRCode.toBuffer(link.toString(), {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 6,
      })
      const qrImg = await pdf.embedPng(qrPng)

      // same QR proportion as single card (*0.7)
      const qrSize = Math.min(box.h - pad * 2, rightW - pad * 2) * 0.7
      const qrX = box.x + leftW + (rightW - qrSize) / 2
      const qrY = box.y + (box.h - qrSize) / 2

      page.drawImage(qrImg, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      })

      // CTA only (no URL, to match single)
      const cta = 'Scan to view this artwork and order prints'
      const ctaSize = 8
      const ctaWidth = fontRegular.widthOfTextAtSize(cta, ctaSize)
      const ctaY = box.y + pad / 2 + 10

      page.drawText(cta, {
        x: box.x + leftW + (rightW - ctaWidth) / 2,
        y: ctaY,
        size: ctaSize,
        font: fontRegular,
        color: rgb(0.35, 0.35, 0.35),
      })
    }

   if (layout === '4up') {
  // Four horizontal cards stacked down the A4 page
  const cardH = (A4.h - 2 * MARGIN - 3 * GUTTER) / 4
  const cardW = A4.w - 2 * MARGIN
  const page = pdf.addPage([A4.w, A4.h])

  const maxPerPage = 4
  const count = Math.min(maxPerPage, artworks.length)

  for (let i = 0; i < count; i++) {
    const a = artworks[i]

    const x = MARGIN
    const y = A4.h - MARGIN - cardH - i * (cardH + GUTTER)

    await drawCard(
      page,
      { x, y, w: cardW, h: cardH },
      {
        slug: a.slug,
        title: a.title,
        artistName: a.artist?.name || '',
      },
      faviconImg
    )
  }
} else {
  // 1-up: keep as you have it
  for (const a of artworks) {
    const page = pdf.addPage([CARD.w, CARD.h])
    await drawCard(
      page,
      { x: 0, y: 0, w: CARD.w, h: CARD.h },
      {
        slug: a.slug,
        title: a.title,
        artistName: a.artist?.name || '',
      },
      faviconImg
    )
  }
}
    

    // Return
    const bytes = await pdf.save()
    const body = new Uint8Array(bytes)

    const mode =
      urlIn.searchParams.get('download') === '1' ? 'attachment' : 'inline'
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${mode}; filename="artfinity-qr-cards-${layout}-${stamp}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Bulk QR PDF error', err)
    return new NextResponse('Server error', { status: 500 })
  }
}