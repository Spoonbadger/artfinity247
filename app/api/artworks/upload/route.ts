import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { jwtVerify } from 'jose'
import slugify from 'slugify'
import { rateLimit } from '@/lib/rateLimit'
import { resend } from "@/lib/resend"
import NewArtworkUploadedEmail from "@/emails/NewArtworkUploadedEmail"
import ArtworkLiveWithQrEmail from "@/emails/ArtworkLiveWithQrEmail";
import { SignJWT } from "jose"
import { parseSensitive } from "@/components/studio/sensitive"
import { EDITION_MAX, EDITION_MIN } from "@/lib/editionFormat"

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

    // 50 uploads per day limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const uploadCount = await prisma.artwork.count({
      where: {
        artistId: payload.id as string,
        createdAt: { gte: todayStart }
      }
    });

    if (uploadCount >= 50) {
      return new NextResponse("Daily upload limit reached (50)", { status: 429 });
    }

    const form = await req.formData();

    const title = String(form.get("title") ?? "").trim();
    const description = String(form.get("description") ?? "");
    const imageUrl = String(form.get("imageUrl") ?? "").trim();
    // Content labels, comma-separated: "Nudity,Violence or gore". Labeled art is blurred for buyers.
    const sensitive = parseSensitive(form.get("sensitive"));
    // Optional: sizes the file can print sharply ("small,medium,..."), from POST /api/uploads.
    // There is no column for it yet, so it is only validated here; sizes still use the markups below.
    const printableRaw = form.get("printable");

    if (!title) return new NextResponse("Title required", { status: 400 });
    if (!imageUrl) return new NextResponse("Image required", { status: 400 });
    if (printableRaw !== null && !String(printableRaw).split(",").filter(Boolean).every((s) => ["small", "medium", "large", "xl"].includes(s.trim()))) {
      return new NextResponse("Invalid printable sizes", { status: 400 });
    }
    const markupSmall = parseInt(form.get("markupSmall") as string) || 0;
    const markupMedium = parseInt(form.get("markupMedium") as string) || 0;
    const markupLarge = parseInt(form.get("markupLarge") as string) || 0;
    const markupXl = parseInt(form.get("markupXl") as string) || 0
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
        status: "APPROVED",
        sensitive,
        editionSize,
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

    const base = process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com"

    const artworkUrl = `${base}/art/${artwork.slug}`

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)

    const qrToken = await new SignJWT({
      slug: artwork.slug,
      artistId: artwork.artistId,
      role: artwork.artist?.role || "ARTIST",
      type: "qr_download",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret)

    const qrDownloadUrl =
      `${base}/api/artworks/${artwork.slug}/qr?download=1&token=${qrToken}`

    try {
      await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: artwork.artist?.email, // if included — otherwise use payload email
        subject: `Your artwork is live – ${artwork.title}`,
        react: ArtworkLiveWithQrEmail({
          artistName: artwork.artist?.artist_name || "",
          title: artwork.title,
          artworkUrl,
          qrDownloadUrl,
        }),
      });
    } catch (err) {
      console.error("Artist QR email failed", err);
    }

    try {
      await resend.emails.send({
        from: "Artfinity <notifications@theartfinity.com>",
        to: "craig@theartfinity.com",
        subject: `New Artwork – ${artwork.title}`,
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
    })
  } catch (err) {
    console.error('Upload error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
