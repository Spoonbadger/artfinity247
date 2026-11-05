import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { verifyAuthTokenOrThrow } from '@/lib/auth'
import { deleteUpload } from '@/lib/storage'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'
import { parseSensitive } from '@/components/studio/sensitive'
import { EDITION_MAX, EDITION_MIN, soldCount } from '@/lib/editions'
import { parsePrintable } from '@/lib/printSizes'
import { verifyPrintable } from '@/lib/printSign'
import { initialArtworkStatus } from '@/lib/artworkLive'
import { checkUpload, duplicateOfId } from '@/lib/imageHash'

export const dynamic = "force-dynamic"
export const dynamicParams = true
export const runtime = "nodejs"



export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  try {
    const payload = await verifyAuthTokenOrThrow(token); // signature, expiry and session version

    const currentArtistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub


    const form = await req.formData()

    const title = form.get("title") as string | null
    const description = form.get("description") as string | null
    const imageUrl = form.get("imageUrl") as string | null
    const markupSmall = form.get("markupSmall") as string | null
    const markupMedium = form.get("markupMedium") as string | null
    const markupLarge = form.get("markupLarge") as string | null
    const markupXl = form.get("markupXl") as string | null
    // Content labels, comma-separated. Send an empty value to clear them; leave the field out to keep them.
    const sensitiveRaw = form.get("sensitive")


    const artwork = await prisma.artwork.findUnique({
      where: { slug: params.slug }
    })

    if (!artwork || String(artwork.artistId) !== String(currentArtistId)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!artwork || artwork.artistId !== payload.id)
      return new NextResponse('Forbidden', { status: 403 })

    // A new image: re-check print sizes and rights, like a new upload.
    const newImage = !!imageUrl && imageUrl !== artwork.imageUrl
    let imageData: { printableSizes: string[]; ownershipConfirmedAt: Date; status?: "PENDING"; imageHash?: string | null; flaggedReason?: string | null; flaggedBy?: string | null } | undefined
    let dup: Awaited<ReturnType<typeof checkUpload>> | null = null
    if (newImage) {
      const printable = parsePrintable(form.get("printable"))
      if (String(form.get("ownership") ?? "") !== "yes") {
        return new NextResponse("Confirm this is your original work and you hold the rights to sell prints of it.", { status: 400 })
      }
      if (!printable || !verifyPrintable(imageUrl!, printable, form.get("printableSig"))) {
        return new NextResponse("Upload the image again so we can check its print sizes.", { status: 400 })
      }
      if (!printable.length) return new NextResponse("This file is too small to print well. Try the original photo or a bigger scan.", { status: 400 })
      imageData = { printableSizes: printable, ownershipConfirmedAt: new Date() }
      // Artists whose uploads are reviewed get a new image reviewed too.
      if (artwork.status === "APPROVED" && (await initialArtworkStatus(artwork.artistId)) === "PENDING") imageData.status = "PENDING"
      // Fingerprint the new image; if it looks like another artist's piece, a person checks it (lib/imageHash.ts).
      dup = await checkUpload(imageUrl!, artwork.artistId, artwork.id)
      imageData.imageHash = dup.imageHash
      if (dup.flaggedReason && artwork.status !== "REJECTED") Object.assign(imageData, { status: "PENDING", flaggedReason: dup.flaggedReason, flaggedBy: "system" })
      // The old image's duplicate flag doesn't describe the new one (it stays in review if it was).
      else if (!dup.flaggedReason && duplicateOfId(artwork.flaggedReason)) Object.assign(imageData, { flaggedReason: null, flaggedBy: null })
    }

    // Limited print run. Leave the field out to keep it; "" = open edition; else EDITION_MIN..EDITION_MAX.
    // Locked once any print has sold (retail or bulk, lib/editions.ts): buyers were promised that size.
    const editionRaw = form.get("editionSize")
    let editionSize: number | null | undefined = undefined
    if (editionRaw !== null) {
      const t = String(editionRaw).trim()
      editionSize = t ? parseInt(t, 10) : null
      if (editionSize !== artwork.editionSize) {
        const sold = await soldCount(artwork.id)
        if (sold > 0) {
          const now = artwork.editionSize ? `${sold} of ${artwork.editionSize} sold` : `${sold} sold as an open edition`
          return new NextResponse(`Locked: ${now}. Editions can't change once a print sells.`, { status: 400 })
        }
        if (editionSize !== null && (!Number.isFinite(editionSize) || editionSize < EDITION_MIN || editionSize > EDITION_MAX)) {
          return new NextResponse(`An edition is ${EDITION_MIN} to ${EDITION_MAX} prints.`, { status: 400 })
        }
      }
    }

    const updated = await prisma.artwork.update({
      where: { slug: params.slug },
      data: {
        title: title ?? artwork.title,
        description: description ?? artwork.description,
        markupSmall:
            markupSmall !== null
              ? Number.isNaN(parseInt(markupSmall, 10))
              ? artwork.markupSmall
              : parseInt(markupSmall, 10)
            : artwork.markupSmall,
        markupMedium:
            markupMedium !== null
              ? Number.isNaN(parseInt(markupMedium, 10))
              ? artwork.markupMedium
              : parseInt(markupMedium, 10)
            : artwork.markupMedium,
        markupLarge:
            markupLarge !== null
              ? Number.isNaN(parseInt(markupLarge, 10))
              ? artwork.markupLarge
              : parseInt(markupLarge, 10)
            : artwork.markupLarge,
        markupXl:
            markupXl !== null
              ? Number.isNaN(parseInt(markupXl, 10))
              ? artwork.markupXl
              : parseInt(markupXl, 10)
            : artwork.markupXl,
        imageUrl: imageUrl || artwork.imageUrl,
        ...(sensitiveRaw !== null ? { sensitive: parseSensitive(sensitiveRaw) } : {}),
        ...(editionSize !== undefined ? { editionSize } : {}),
        ...(imageData ?? {}),
        },
    })


    // Replaced: delete the old preview and original, unless an order still needs the old file for printing.
    if (newImage && artwork.imageUrl) {
      try {
        const ordered = await prisma.orderItem.count({ where: { imageUrl: artwork.imageUrl } })
        if (!ordered) await deleteUpload(artwork.imageUrl)
      } catch (err) {
        console.error("Old image deletion failed:", err)
      }
    }

    const artist = await prisma.artist.findUnique({
      where: { id: updated.artistId },
      select: { slug: true },
    })

    return NextResponse.json({
      ...updated,
      artistSlug: artist?.slug,
      duplicate: dup?.duplicate ?? null,
      notice: dup?.notice ?? null,
    })
  } catch (err) {
    console.error('Editing error', err)
    return new NextResponse('Server error', { status: 500 })
  }
}