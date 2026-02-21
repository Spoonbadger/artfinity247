import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { jwtVerify } from 'jose'
import slugify from 'slugify'
import { rateLimit } from '@/lib/rateLimit'
import { Resend } from "resend";
import NewArtworkUploadedEmail from "@/emails/NewArtworkUploadedEmail"
import ArtworkLiveWithQrEmail from "@/emails/ArtworkLiveWithQrEmail";


const resend = new Resend(process.env.RESEND_API_KEY)

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

    const title = form.get("title") as string;
    const description = form.get("description") as string;
    const imageUrl = form.get("imageUrl") as string;
    const markupSmall = parseInt(form.get("markupSmall") as string) || 0;
    const markupMedium = parseInt(form.get("markupMedium") as string) || 0;
    const markupLarge = parseInt(form.get("markupLarge") as string) || 0;


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
        description: description || '',
        imageUrl: imageUrl,
        artistId: payload.id as string,
        status: "APPROVED",
      },
      include: {
        artist: {
          select: {
            slug: true,
            artist_name: true,
            city: true,
            state: true,
            email: true,
          },
        },
      },
    });

    const base =
  process.env.NEXT_PUBLIC_APP_URL || "https://theartfinity.com";

  const artworkUrl = `${base}/art/${artwork.slug}`;

  const qrDownloadUrl = `${base}/api/qr?layout=1up&slugs=${artwork.slug}&download=1`;

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
