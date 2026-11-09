import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { activeUserGuard } from '@/lib/auth'
import { deleteUpload } from '@/lib/storage'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'
import { parseSensitive } from '@/components/studio/sensitive'
import { EDITION_MAX, EDITION_MIN, soldCount } from '@/lib/editions'
import { parsePrintable } from '@/lib/printSizes'
import { verifyPrintable } from '@/lib/printSign'
import { alertArtworkNeedsReview, initialArtworkStatus } from '@/lib/artworkLive'
import { checkUpload, duplicateOfId } from '@/lib/imageHash'
import { saveAutoCheck, screenUpload, type Screened } from '@/lib/moderation'
import { isAutoFlag } from '@/lib/moderation/policy'
import { editsFromForm } from '@/lib/imageEdits.server'
import { parseStored } from '@/lib/imageEdits'
import { Prisma } from '@prisma/client'

export const dynamic = "force-dynamic"
export const dynamicParams = true
export const runtime = "nodejs"



export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { user: payload, denied } = await activeUserGuard("Log in to keep going.") // signed in, not paused or closed
  if (denied) return denied

  try {
    const currentArtistId = payload.id


    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: "Nothing came through. Refresh and try again.", code: "bad_request" }, { status: 400 })

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
      return NextResponse.json({ error: "That piece isn't yours.", code: "not_your_art" }, { status: 403 })
    }

    if (!artwork || artwork.artistId !== payload.id)
      return NextResponse.json({ error: "That piece isn't yours.", code: "not_your_art" }, { status: 403 })

    // A new image: re-check print sizes and rights, like a new upload.
    const newImage = !!imageUrl && imageUrl !== artwork.imageUrl
    // Photo edits (POST /api/uploads/edit). Left out: kept, unless the image itself was swapped for another.
    const oldEdits = parseStored(artwork.imageEdits)
    const sentEdits = editsFromForm(form.get("imageEdits"), { id: payload.id, slug: payload.slug }, [artwork.imageUrl, oldEdits?.source])
    const nextEdits = sentEdits !== undefined ? sentEdits : newImage ? null : oldEdits
    // An edit of this piece's own photo (or a reset back to it) is the same picture: no new rights box, no new review.
    const derived = newImage && ((!!nextEdits && (nextEdits.source === artwork.imageUrl || nextEdits.source === oldEdits?.source)) || (!!oldEdits && imageUrl === oldEdits.source))
    let imageData: { printableSizes: string[]; ownershipConfirmedAt: Date; status?: "PENDING"; imageHash?: string | null; flaggedReason?: string | null; flaggedBy?: string | null; sensitive?: string[] } | undefined
    let dup: Awaited<ReturnType<typeof checkUpload>> | null = null
    let check: Screened | null = null
    if (newImage) {
      const printable = parsePrintable(form.get("printable"))
      if (!derived && String(form.get("ownership") ?? "") !== "yes") {
        return NextResponse.json({ error: "Confirm this is your original work and you hold the rights to sell prints of it.", code: "ownership_required" }, { status: 400 })
      }
      if (!printable || !verifyPrintable(imageUrl!, printable, form.get("printableSig"))) {
        return NextResponse.json({ error: "Upload the image again so we can check its print sizes.", code: "reupload" }, { status: 400 })
      }
      if (!printable.length) return NextResponse.json({ error: "This file is too small to print well. Try the original photo or a bigger scan.", code: "image_too_small" }, { status: 400 })
      imageData = { printableSizes: printable, ownershipConfirmedAt: new Date() }
      // Artists whose uploads are reviewed get a new image reviewed too.
      if (!derived && artwork.status === "APPROVED" && (await initialArtworkStatus(artwork.artistId)) === "PENDING") imageData.status = "PENDING"
      // Fingerprint the new image; if it looks like another artist's piece, a person checks it (lib/imageHash.ts).
      // The automatic image check (lib/moderation) runs on a new image too, like a new upload.
      const labels = sensitiveRaw !== null ? parseSensitive(sensitiveRaw) : artwork.sensitive
      ;[dup, check] = await Promise.all([
        checkUpload(imageUrl!, artwork.artistId, artwork.id),
        screenUpload({ imageUrl: imageUrl!, title: title ?? artwork.title, artistLabels: labels }),
      ])
      const mod = check.decision
      imageData.imageHash = dup.imageHash
      if (mod.addedLabels.length) imageData.sensitive = mod.labels
      if (dup.flaggedReason && artwork.status !== "REJECTED") Object.assign(imageData, { status: "PENDING", flaggedReason: dup.flaggedReason, flaggedBy: "system" })
      else if (mod.flaggedReason && artwork.status !== "REJECTED") Object.assign(imageData, { status: "PENDING", flaggedReason: mod.flaggedReason, flaggedBy: "system" })
      // The old image's duplicate or image-check flag doesn't describe the new one (it stays in review if it was).
      else if (duplicateOfId(artwork.flaggedReason) || isAutoFlag(artwork.flaggedReason)) Object.assign(imageData, { flaggedReason: null, flaggedBy: null })
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
          return NextResponse.json({ error: `Locked: ${now}. Editions can't change once a print sells.`, code: "edition_locked" }, { status: 400 })
        }
        if (editionSize !== null && (!Number.isFinite(editionSize) || editionSize < EDITION_MIN || editionSize > EDITION_MAX)) {
          return NextResponse.json({ error: `An edition is ${EDITION_MIN} to ${EDITION_MAX} prints.`, code: "invalid_edition" }, { status: 400 })
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
        ...(nextEdits !== oldEdits ? { imageEdits: nextEdits ? (nextEdits as unknown as Prisma.InputJsonValue) : Prisma.DbNull } : {}),
        ...(imageData ?? {}),
        },
    })


    // Replaced: delete the old preview and original, unless an order still needs the old file for printing,
    // or it's the untouched photo the new edits were made from (kept so "Reset edits" can go back to it).
    // An old edit source nothing points at any more goes too.
    if (newImage && artwork.imageUrl) {
      const keep = new Set([updated.imageUrl, nextEdits?.source].filter(Boolean))
      for (const old of new Set([artwork.imageUrl, oldEdits?.source])) {
        if (!old || keep.has(old)) continue
        try {
          const ordered = await prisma.orderItem.count({ where: { imageUrl: old } })
          if (!ordered) await deleteUpload(old)
        } catch (err) {
          console.error("Old image deletion failed:", err)
        }
      }
    }

    if (check) {
      await saveAutoCheck(updated.id, check)
      if (check.decision.outcome === "review" && updated.status === "PENDING") await alertArtworkNeedsReview(updated.id)
    }

    const artist = await prisma.artist.findUnique({
      where: { id: updated.artistId },
      select: { slug: true },
    })

    return NextResponse.json({
      ...updated,
      artistSlug: artist?.slug,
      duplicate: dup?.duplicate ?? null,
      moderation: check?.decision.outcome === "review" || check?.decision.outcome === "labeled" ? check.decision.outcome : null,
      notice: dup?.duplicate === "review" ? dup.notice : [check?.decision.notice, dup?.notice].filter(Boolean).join(" ") || null,
    })
  } catch (err) {
    console.error('Editing error', err)
    // An expired or tampered login cookie: ask them to log in again rather than calling it our fault.
    if (String((err as { code?: unknown })?.code ?? "").startsWith("ERR_JW")) return NextResponse.json({ error: "Your login ran out. Log in again to keep going.", code: "not_logged_in" }, { status: 401 })
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, { status: 500 })
  }
}