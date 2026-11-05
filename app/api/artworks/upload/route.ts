import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { jwtVerify } from 'jose'
import slugify from 'slugify'
import { rateLimit } from '@/lib/rateLimit'
import { resend } from "@/lib/resend"
import NewArtworkUploadedEmail from "@/emails/NewArtworkUploadedEmail"
import { parseSensitive } from "@/components/studio/sensitive"
import { EDITION_MAX, EDITION_MIN } from "@/lib/editionFormat"
import { parsePrintable } from "@/lib/printSizes"
import { verifyPrintable } from "@/lib/printSign"
import { announceArtworkLive, initialArtworkStatus } from "@/lib/artworkLive"
import { checkUpload } from "@/lib/imageHash"
import { DAILY_UPLOAD_LIMIT } from "@/lib/uploadLimits"

export const dynamic = "force-dynamic"


export async function POST(req: NextRequest) {
  const token = req.cookies.get('auth-token')?.value;
  if (!token) return new NextResponse('Not authenticated', { status: 401 });

  try {
    const rawIp = req.headers.get("x-forwarded-for");
    const ip = rawIp?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(ip)) {
      return new NextResponse("Too many requests", { status: 429 });
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )

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
      return new NextResponse(`Daily upload limit reached (${DAILY_UPLOAD_LIMIT})`, { status: 429 });
    }

    const form = await req.formData();

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

    if (!title) return new NextResponse("Title required", { status: 400 });
    if (!imageUrl) return new NextResponse("Image required", { status: 400 });
    if (!ownership) return new NextResponse("Confirm this is your original work and you hold the rights to sell prints of it.", { status: 400 });
    if (!printable || !verifyPrintable(imageUrl, printable, form.get("printableSig"))) {
      return new NextResponse("Upload the image again so we can check its print sizes.", { status: 400 });
    }
    if (!printable.length) return new NextResponse("This file is too small to print well. Try the original photo or a bigger scan.", { status: 400 });
    const markupSmall = parseInt(form.get("markupSmall") as string) || 0;
    const markupMedium = parseInt(form.get("markupMedium") as string) || 0;
    const markupLarge = parseInt(form.get("markupLarge") as string) || 0;
    const markupXl = parseInt(form.get("markupXl") as string) || 0
    // A markup is what the artist adds on top of the base price, so it can't be negative.
    if ([markupSmall, markupMedium, markupLarge, markupXl].some((m) => m < 0)) {
      return new NextResponse("Prices can't go below the starting price for each size.", { status: 400 })
    }
    // Limited print run: empty = open edition, otherwise EDITION_MIN..EDITION_MAX prints.
    const editionRaw = String(form.get("editionSize") ?? "").trim()
    const editionSize = editionRaw ? parseInt(editionRaw, 10) : null
    if (editionSize !== null && (!Number.isFinite(editionSize) || editionSize < EDITION_MIN || editionSize > EDITION_MAX)) {
      return new NextResponse(`An edition is ${EDITION_MIN} to ${EDITION_MAX} prints.`, { status: 400 })
    }


    const slug =
      slugify(title, { lower: true, strict: true }) +
      '-' +
      Date.now().toString(36).slice(-4) // To be unique

    // First pieces from new, unverified artists wait for a quick review.
    // So does anything that looks like another artist's piece (lib/imageHash.ts): flagged, never auto-rejected.
    const dup = await checkUpload(imageUrl, payload.id as string)
    const status = dup.flaggedReason ? "PENDING" : await initialArtworkStatus(payload.id as string)

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
        sensitive,
        editionSize,
        printableSizes: printable,
        ownershipConfirmedAt: new Date(),
        imageHash: dup.imageHash,
        ...(dup.flaggedReason ? { flaggedReason: dup.flaggedReason, flaggedBy: "system" } : {}),
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

    // Live now: referral reward + the artist's "it's live" email. Pending pieces get these on approval.
    // In a batch the email waits for the batch summary; the referral reward doesn't.
    if (artwork.status === "APPROVED") await announceArtworkLive(artwork.id, { email: !batch })

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
      notice: dup.notice,
    })
  } catch (err) {
    console.error('Upload error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
