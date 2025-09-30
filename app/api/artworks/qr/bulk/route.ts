import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { jwtVerify } from 'jose'
import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib'

export const runtime = 'nodejs'

// A4 portrait ~ 595 x 842 pts; A6 ~ 298 x 420 pts
const A4 = { w: 595, h: 842 }
const A6 = { w: 298, h: 420 }
const MARGIN = 24
const GUTTER = 16 // spacing between cards (4-up)

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
    const artworks = rows.filter(a => a.slug) as { slug: string; title: string; artist: { name: string } }[]
    if (!artworks.length) return new NextResponse('No artworks found', { status: 404 })

    // Base URL
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
    const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
    const base = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`

    // Build PDF + fonts
    const pdf = await PDFDocument.create()
    const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    // helper (function expression to avoid ES5 strict error)
    const drawCard = async (
      page: PDFPage | any,
      box: { x: number; y: number; w: number; h: number },
      art: { slug: string; title: string; artistName: string }
    ) => {
      const pad = 14
      let y = box.y + box.h - pad

      // Header
      const header = 'ARTFINITY'
      const headerSize = 9
      const headerWidth = fontRegular.widthOfTextAtSize(header, headerSize)
      page.drawText(header, {
        x: box.x + box.w - pad - headerWidth,
        y: y - headerSize,
        size: headerSize,
        font: fontRegular,
        color: rgb(0.33, 0.33, 0.33),
      })
      y -= headerSize + 6

      // Title
      const titleSize = 14
      page.drawText(art.title, {
        x: box.x + pad,
        y: y - titleSize,
        size: titleSize,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      y -= titleSize + 4

      // Artist
      const artistSize = 11
      page.drawText(art.artistName, {
        x: box.x + pad,
        y: y - artistSize,
        size: artistSize,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      })
      y -= artistSize + 8

      // Divider
      page.drawLine({
        start: { x: box.x + pad, y },
        end: { x: box.x + box.w - pad, y },
        thickness: 1,
        color: rgb(0.9, 0.9, 0.9),
      })
      y -= 8

      // Link + QR
      const link = new URL(`${base}/art/${art.slug}`)
      link.searchParams.set('utm_source', 'qr')
      link.searchParams.set('utm_medium', 'print')
      link.searchParams.set('utm_campaign', art.slug)

      const qrPng = await QRCode.toBuffer(link.toString(), { errorCorrectionLevel: 'M', margin: 1, scale: 6 })
      const qrImg = await pdf.embedPng(qrPng)
      const qrSize = Math.min(140, box.w - pad * 2)
      const qrX = box.x + (box.w - qrSize) / 2
      const qrY = y - qrSize
      page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize })
      y = qrY - 6

      // CTA
      const cta = 'Scan to order prints online'
      const ctaSize = 9
      const ctaWidth = fontRegular.widthOfTextAtSize(cta, ctaSize)
      page.drawText(cta, {
        x: box.x + (box.w - ctaWidth) / 2,
        y: y - ctaSize,
        size: ctaSize,
        font: fontRegular,
        color: rgb(0.33, 0.33, 0.33),
      })
      y -= ctaSize + 2

      // URL
      const urlSize = 7
      const urlText = link.toString()
      const urlWidth = fontRegular.widthOfTextAtSize(urlText, urlSize)
      page.drawText(urlText, {
        x: box.x + (box.w - urlWidth) / 2,
        y: y - urlSize,
        size: urlSize,
        font: fontRegular,
        color: rgb(0.5, 0.5, 0.5),
      })
    }

    if (layout === '4up') {
      // A4 2x2 grid
      const cardW = (A4.w - 2 * MARGIN - GUTTER) / 2
      const cardH = (A4.h - 2 * MARGIN - GUTTER) / 2

      for (let i = 0; i < artworks.length; i += 4) {
        const page = pdf.addPage([A4.w, A4.h])
        const group = artworks.slice(i, i + 4)
        const positions = [
          { x: MARGIN, y: A4.h - MARGIN - cardH },                   // top-left
          { x: MARGIN + cardW + GUTTER, y: A4.h - MARGIN - cardH },  // top-right
          { x: MARGIN, y: MARGIN },                                  // bottom-left
          { x: MARGIN + cardW + GUTTER, y: MARGIN },                 // bottom-right
        ]
        for (let j = 0; j < group.length; j++) {
          const a = group[j]
          await drawCard(page, { x: positions[j].x, y: positions[j].y, w: cardW, h: cardH }, {
            slug: a.slug,
            title: a.title,
            artistName: a.artist?.name || '',
          })
        }
      }
    } else {
      // 1-up: one A6 per artwork
      for (const a of artworks) {
        const page = pdf.addPage([A6.w, A6.h])
        await drawCard(page, { x: 0, y: 0, w: A6.w, h: A6.h }, {
          slug: a.slug,
          title: a.title,
          artistName: a.artist?.name || '',
        })
      }
    }

    // Return
    const bytes = await pdf.save()
    const body = new Uint8Array(bytes)

    const mode = urlIn.searchParams.get('download') === '1' ? 'attachment' : 'inline'
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
