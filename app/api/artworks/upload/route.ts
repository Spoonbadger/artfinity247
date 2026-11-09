import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { activeUserGuard } from '@/lib/auth'
import slugify from 'slugify'
import { rateLimit } from '@/lib/rateLimit'
import { resend } from "@/lib/resend"
import NewArtworkUploadedEmail from "@/emails/NewArtworkUploadedEmail"
import { parseSensitive } from "@/components/studio/sensitive"
import { EDITION_MAX, EDITION_MIN } from "@/lib/editionFormat"
import { parsePrintable } from "@/lib/printSizes"
import { verifyPrintable } from "@/lib/printSign"
import { alertArtworkNeedsReview, announceArtworkLive, initialArtworkStatus } from "@/lib/artworkLive"
import { checkUpload } from "@/lib/imageHash"
import { saveAutoCheck, screenUpload } from "@/lib/moderation"
import { DAILY_UPLOAD_LIMIT } from "@/lib/uploadLimits"
import { editsFromForm } from "@/lib/imageEdits.server"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"


export async function POST(req: NextRequest) {
  const { user: payload, denied } = await activeUserGuard("Log in to keep going."); // signed in, not paused or closed
  if (denied) return denied;

  try {
    const rawIp = req.headers.get("x-forwarded-for");
    const ip = rawIp?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: "Too many uploads at once. Wait a minute and try again.", code: "rate_limited" }, { status: 429 });
    }

    // Daily upload limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const uploadCount = await prisma.artwork.count({
      where: {
        artistId: payload.id as string,
        createdAt: { gte: todayStart }
      }
    });

    if (uploadCount >= DAILY_UPLOAD_LIMIT) {
      return NextResponse.json({ error: `That's today's upload limit (${DAILY_UPLOAD_LIMIT}). Upload more tomorrow.`, code: "upload_limit" }, { status: 429 });
    }

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Nothing came through. Refresh and try again.", code: "bad_request" }, { status: 400 });

    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "");
    const imageUrl = String(form.get("imageUrl") ?? "").trim();
    // Content labels, comma-separated: "Nudity,Violence or gore". Labeled art is blurred for buyers.
    const sensitive = parseSensitive(form.get("sensitive"));
    // Sizes the file prints sharply ("small,medium,..."), measured and signed by POST /api/uploads.
    const printable = parsePrintable(form.get("printable"));
    // Rights: the artist ticks "This is my original work and I hold the rights to sell prints of it."
    const ownership = String(form.get("ownership") ?? "") === "yes";
    // Part of an upload queue (several paintings at once): the artist's "it's live" email and the team's
    // notification wait for one summary of the whole batch (POST /api/artworks/upload/summary).
    const batch = String(form.get("batch") ?? "") === "1";
    // Photo edits behind imageUrl (POST /api/uploads/edit): kept so the artist can change or reset them later.
    const imageEdits = editsFromForm(form.get("imageEdits"), { id: payload.id as string, slug: payload.slug as string | undefined });

    if (!title) return NextResponse.json({ error: "Give it a title.", code: "title_required" }, { status: 400 });
    if (!imageUrl) return NextResponse.json({ error: "Add an image first.", code: "image_required" }, { status: 400 });
    if (!ownership) return NextResponse.json({ error: "Confirm this is your original work and you hold the rights to sell prints of it.", code: "ownership_required" }, { status: 400 });
    if (!printable || !verifyPrintable(imageUrl, printable, form.get("printableSig"))) {
      return NextResponse.json({ error: "Upload the image again so we can check its print sizes.", code: "reupload" }, { status: 400 });
    }
    if (!printable.length) return NextResponse.json({ error: "This file is too small to print well. Try the original photo or a bigger scan.", code: "image_too_small" }, { status: 400 });
    const markupSmall = parseInt(form.get("markupSmall") as string) || 0;
    const markupMedium = parseInt(form.get("markupMedium") as string) || 0;
    const markupLarge = parseInt(form.get("markupLarge") as string) || 0;
    const markupXl = parseInt(form.get("markupXl") as string) || 0
    // A markup is what the artist adds on top of the base price, so it can't be negative.
    if ([markupSmall, markupMedium, markupLarge, markupXl].some((m) => m < 0)) {
      return NextResponse.json({ error: "Prices can't go below the starting price for each size.", code: "price_too_low" }, { status: 400 })
    }
    // Limited print run: empty = open edition, otherwise EDITION_MIN..EDITION_MAX prints.
    const editionRaw = String(form.get("editionSize") ?? "").trim()
    const editionSize = editionRaw ? parseInt(editionRaw, 10) : null
    if (editionSize !== null && (!Number.isFinite(editionSize) || editionSize < EDITION_MIN || editionSize > EDITION_MAX)) {
      return NextResponse.json({ error: `An edition is ${EDITION_MIN} to ${EDITION_MAX} prints.`, code: "invalid_edition" }, { status: 400 })
    }


    const slug =
      slugify(title, { lower: true, strict: true }) +
      '-' +
      Date.now().toString(36).slice(-4) // To be unique

    // First pieces from new, unverified artists wait for a quick review.
    // So does anything that looks like another artist's piece (lib/imageHash.ts): flagged, never auto-rejected.
    // The automatic image check (lib/moderation, off unless IMAGE_MODERATION_PROVIDER is set) runs alongside on the
    // stored preview: it can add a sensitive label (stays live, blurred) or hold explicit content, gore or hate for a
    // person. If the provider is down or slow, it changes nothing.
    const [dup, check] = await Promise.all([
      checkUpload(imageUrl, payload.id as string),
      screenUpload({ imageUrl, title, artistLabels: sensitive }),
    ])
    const mod = check.decision
    const flaggedReason = dup.flaggedReason || mod.flaggedReason
    const status = flaggedReason ? "PENDING" : await initialArtworkStatus(payload.id as string)

    const artwork = await prisma.artwork.create({
      data: {
        title,
        slug,
        markupSmall,
        markupMedium,
        markupLarge,
        markupXl,
        description: description || '',
        imageUrl: imageUrl,
        artistId: payload.id as string,
        status,
        sensitive: mod.labels,
        editionSize,
        printableSizes: printable,
        ownershipConfirmedAt: new Date(),
        imageHash: dup.imageHash,
        ...(imageEdits ? { imageEdits: imageEdits as unknown as Prisma.InputJsonValue } : {}),
        ...(flaggedReason ? { flaggedReason, flaggedBy: "system" } : {}),
      },
      include: {
        artist: {
          select: {
            slug: true,
            artist_name: true,
            city: true,
            state: true,
            email: true,
            role: true,
          },
        },
      },
    });

    await saveAutoCheck(artwork.id, check)

    // Live now: referral reward + the artist's "it's live" email. Pending pieces get these on approval.
    // In a batch the email waits for the batch summary; the referral reward doesn't.
    if (artwork.status === "APPROVED") await announceArtworkLive(artwork.id, { email: !batch })
    else await alertArtworkNeedsReview(artwork.id) // admin alert: possible duplicate, image check, or first pieces to review

    if (!batch) try {
      await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: "craig@theartfinity.com",
        subject: `${dup.duplicate === "review" ? "Possible duplicate" : artwork.status === "PENDING" ? "To review" : "New Artwork"} – ${artwork.title}`,
        react: NewArtworkUploadedEmail({
          artistName: artwork?.artist.artist_name || "unknown",
          title: artwork.title,
          imageUrl: artwork.imageUrl,
          city: artwork.artist.city,
          state: artwork.artist.state,
          createdAt: new Date().toLocaleString(),
        }),
      })
    } catch (err) {
      console.error("Artwork notification email failed", err)
    }

    return NextResponse.json({
      ...artwork,
      artistSlug: artwork.artist?.slug,
      // "review": looks like another artist's piece, a person checks it. "own": the artist uploaded it before.
      duplicate: dup.duplicate,
      // Image check: "review" = held for a person, "labeled" = we added addedLabels (the artist can change them).
      moderation: mod.outcome === "review" || mod.outcome === "labeled" ? mod.outcome : null,
      addedLabels: mod.addedLabels,
      notice: dup.duplicate === "review" ? dup.notice : [mod.notice, dup.notice].filter(Boolean).join(" ") || null,
    })
  } catch (err) {
    console.error('Upload error:', err);
    // An expired or tampered login cookie: ask them to log in again rather than calling it our fault.
    if (String((err as { code?: unknown })?.code ?? "").startsWith("ERR_JW")) return NextResponse.json({ error: "Your login ran out. Log in again to keep going.", code: "not_logged_in" }, { status: 401 })
    return NextResponse.json({ error: "Something went wrong on our side. Try again in a moment.", code: "server_error" }, { status: 500 });
  }
}
