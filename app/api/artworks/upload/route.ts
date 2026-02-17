import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { jwtVerify } from 'jose'
import slugify from 'slugify'
import { rateLimit } from '@/lib/rateLimit'


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
    })

    const artist = await prisma.artist.findUnique({
      where: { id: payload.id as string },
      select: { slug: true },
    });

    return NextResponse.json({
      ...artwork,
      artistSlug: artist?.slug,
    });
  } catch (err) {
    console.error('Upload error:', err);
    return new NextResponse('Server error', { status: 500 });
  }
}
