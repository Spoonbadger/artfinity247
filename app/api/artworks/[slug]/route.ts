import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import { getUserFromCookie, verifyAuthTokenOrThrow } from '@/lib/auth'
import cloudinary from '@/lib/cloudinary'

export const dynamic = "force-dynamic"
export const dynamicParams = true

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {

  try {
    const artwork = await prisma.artwork.findUnique({
      where: { slug: params.slug },
      select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          imageUrl: true,
          markupSmall: true,
          markupMedium: true,
          markupLarge: true,
          markupXl: true,
          artistId: true,
          status: true,
          sensitive: true,
          artist: {
            select: {
              id: true,
              slug: true,
              name: true,
              artist_name: true,
            },
          },
        },
      })


    if (!artwork) {
      return new NextResponse('Artwork not found', { status: 404 })
    }

    // Pending/rejected work is only visible to its artist and admins.
    if (artwork.status !== 'APPROVED') {
      const user = await getUserFromCookie()
      const canSee = !!user && (user.id === artwork.artistId || user.role === 'ADMIN')
      if (!canSee) return new NextResponse('Artwork not found', { status: 404 })
      return NextResponse.json(artwork, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    return NextResponse.json(artwork)
  } catch (err) {
    console.error('GET artwork failed', err)
    return new NextResponse('Server error', { status: 500 })
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } } // keeps same route file
) {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return new NextResponse("Not authenticated", { status: 401 });

  try {
    const payload = await verifyAuthTokenOrThrow(token); // signature, expiry and session version

    const idOrSlug = params.slug;

    // crude cuid-ish check; adjust if you use UUIDs
    const looksLikeId = /^c[0-9a-z]+$/i.test(idOrSlug) && idOrSlug.length >= 12;

    // resolve the artwork by id or slug
    const artwork = await prisma.artwork.findUnique({
      where: looksLikeId ? { id: idOrSlug } : { slug: idOrSlug },
      select: { id: true, artistId: true },
    });

    if (!artwork) return new NextResponse("Artwork not found", { status: 404 });

    // token was signed with { id, email, slug }
    const currentArtistId =
      (payload as any).id ||
      (payload as any).artistId ||
      (payload as any).userId ||
      (payload as any).sub;

    if (String(artwork.artistId) !== String(currentArtistId)) {
      return new NextResponse("Unauthorized", { status: 403 });
    }

    await prisma.artwork.delete({ where: { id: artwork.id } });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("Delete failed:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}

