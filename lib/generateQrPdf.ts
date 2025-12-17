import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs/promises'
import path from 'path'

type GenerateQrPdfInput = { title: string; artistName: string; url: string }

// Horizontal business-card style
const CARD = { w: 420, h: 210 }
const PAD = 20

export async function generateQrPdf({
  title,
  artistName,
  url,
}: GenerateQrPdfInput): Promise<Uint8Array> {

  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([CARD.w, CARD.h])

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  // Load favicon logo
  const faviconPath = path.join(
    process.cwd(),
    'public',
    'favicons',
    'apple-touch-icon.png'
  )
  const faviconBytes = await fs.readFile(faviconPath)
  const faviconImg = await pdfDoc.embedPng(faviconBytes)

  // Background card
  page.drawRectangle({
    x: 0, y: 0,
    width: CARD.w,
    height: CARD.h,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  })

  // Left/right columns
  const leftW = CARD.w * 0.55
  const rightW = CARD.w - leftW

  // --- Logo (top left)
  const logoSize = 40
  const logoX = PAD
  const logoY = CARD.h - PAD - logoSize

  page.drawImage(faviconImg, {
    x: logoX,
    y: logoY,
    width: logoSize,
    height: logoSize,
  })

  // Brand text
  // const brandSize = 12
  // page.drawText('Artfinity', {
  //   x: logoX + logoSize + 10,
  //   y: logoY + logoSize / 2 - brandSize / 2,
  //   size: brandSize,
  //   font: fontBold,
  //   color: rgb(0.35, 0.35, 0.35),
  // })

  // Title + artist
  let textY = logoY - 30

  const titleSize = 18
  page.drawText(title, {
    x: PAD,
    y: textY,
    size: titleSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })
  textY -= titleSize + 4

  const artistSize = 14
  page.drawText(artistName, {
    x: PAD,
    y: textY,
    size: artistSize,
    font: fontRegular,
    color: rgb(0.25, 0.25, 0.25),
  })

  // --- QR Code (right side)
  const qrPng = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
  })
  const qrImg = await pdfDoc.embedPng(qrPng)

  const qrSize = Math.min(CARD.h - PAD * 2, rightW - PAD * 2) * .7
  const qrX = leftW + (rightW - qrSize) / 2
  const qrY = (CARD.h - qrSize) / 2

  page.drawImage(qrImg, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  })

  // --- CTA under QR
  const cta = 'Scan to view this artwork and order prints'
  const ctaSize = 8
  const ctaWidth = fontRegular.widthOfTextAtSize(cta, ctaSize)

  page.drawText(cta, {
    x: leftW + (rightW - ctaWidth) / 2,
    y: PAD / 2 + 10,
    size: ctaSize,
    font: fontRegular,
    color: rgb(0.35, 0.35, 0.35),
  })

  // --- URL (tiny)
  // const urlSize = 7
  // const urlWidth = fontRegular.widthOfTextAtSize(url, urlSize)

  // page.drawText(url, {
  //   x: leftW + (rightW - urlWidth) / 2,
  //   y: PAD / 2,
  //   size: urlSize,
  //   font: fontRegular,
  //   color: rgb(0.5, 0.5, 0.5),
  // })

  // Output as PDF
  return pdfDoc.save()
}
