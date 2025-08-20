import QRCode from 'qrcode'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

type GenerateQrPdfInput = { title: string; artistName: string; url: string }

// A6 portrait ~ 298 x 420 points
const A6 = { w: 298, h: 420 }
const MARGIN = 24

export async function generateQrPdf({
  title,
  artistName,
  url,
}: GenerateQrPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([A6.w, A6.h])
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  let y = A6.h - MARGIN

  // Header: ARTFINITY (right aligned)
  const header = 'ARTFINITY'
  const headerSize = 10
  const headerWidth = fontRegular.widthOfTextAtSize(header, headerSize)
  page.drawText(header, {
    x: A6.w - MARGIN - headerWidth,
    y: y - headerSize,
    size: headerSize,
    font: fontRegular,
    color: rgb(0.33, 0.33, 0.33),
  })
  y -= headerSize + 6

  // Title
  const titleSize = 16
  page.drawText(title, {
    x: MARGIN,
    y: y - titleSize,
    size: titleSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })
  y -= titleSize + 4

  // Artist
  const artistSize = 12
  page.drawText(artistName, {
    x: MARGIN,
    y: y - artistSize,
    size: artistSize,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  })
  y -= artistSize + 8

  // Divider
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: A6.w - MARGIN, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.9),
  })
  y -= 10

  // QR image (centered)
  const qrPng = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', margin: 1, scale: 8 })
  const qrImage = await pdfDoc.embedPng(qrPng)
  const qrSize = 160
  const qrX = (A6.w - qrSize) / 2
  const qrY = y - qrSize
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
  y = qrY - 8

  // CTA
  const cta = 'Scan to order prints online'
  const ctaSize = 10
  const ctaWidth = fontRegular.widthOfTextAtSize(cta, ctaSize)
  page.drawText(cta, {
    x: (A6.w - ctaWidth) / 2,
    y: y - ctaSize,
    size: ctaSize,
    font: fontRegular,
    color: rgb(0.33, 0.33, 0.33),
  })
  y -= ctaSize + 2

  // URL (tiny)
  const urlSize = 8
  const urlWidth = fontRegular.widthOfTextAtSize(url, urlSize)
  page.drawText(url, {
    x: (A6.w - urlWidth) / 2,
    y: y - urlSize,
    size: urlSize,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  })

  return pdfDoc.save()
}