// lib/generateQrPdf.ts
import PDFDocument from 'pdfkit'
import QRCode from 'qrcode'

type GenerateQrPdfInput = {
  title: string
  artistName: string
  url: string // absolute URL to /art/[slug]
}

export async function generateQrPdf({
  title,
  artistName,
  url,
}: GenerateQrPdfInput): Promise<Buffer> {
  // 1) Make QR as PNG buffer
  const qrPng = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
  })

  // 2) Build a clean A6/Business-card-ish PDF (we’ll use A6 portrait)
  const doc = new PDFDocument({
    size: 'A6', // 105 x 148 mm
    margins: { top: 24, left: 24, right: 24, bottom: 24 },
    info: {
      Title: `${title} — QR Card`,
      Author: artistName,
      Subject: 'Artfinity QR Display Card',
    },
  })

  const chunks: Buffer[] = []
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  // Logo / header (optional – text for now)
  doc
    .fontSize(10)
    .fillColor('#555')
    .text('ARTFINITY', { align: 'right' })
    .moveDown(0.5)

  // Title
  doc
    .fontSize(16)
    .fillColor('#000')
    .text(title, { align: 'left' })

  // Artist
  doc
    .moveDown(0.25)
    .fontSize(12)
    .fillColor('#333')
    .text(artistName, { align: 'left' })

  // Divider
  doc
    .moveDown(0.5)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .strokeColor('#e5e5e5')
    .stroke()
    .moveDown(0.5)

  // QR centered
  const qrSize = 160 // px in PDF points
  const centerX =
    (doc.page.width - doc.page.margins.left - doc.page.margins.right - qrSize) /
      2 +
    doc.page.margins.left

  doc.image(qrPng, centerX, doc.y, { width: qrSize, height: qrSize })
  doc.moveDown(0.5)

  // Call-to-action
  doc
    .fontSize(10)
    .fillColor('#555')
    .text('Scan to order prints online', { align: 'center' })

  // Tiny URL footer
  doc
    .moveDown(0.25)
    .fontSize(8)
    .fillColor('#888')
    .text(url, { align: 'center' })

  doc.end()
  return done
}