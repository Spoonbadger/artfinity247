import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import {  } from '@/lib/auth'
import { jwtVerify } from 'jose'
import cloudinary from '@/lib/cloudinary'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'

export const runtime = "nodejs"

function extractPublicId(url: string) {
  const parts = url.split("/upload/")[1]
  if (!parts) return null

  const segments = parts.split("/")
  segments.shift() // remove transformation part if present
  return segments.join("/").split(".")[0]
}

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return new NextResponse('Not authenticated', { status: 401 })

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(process.env.JWT_SECRET!)
    )

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


    const artwork = await prisma.artwork.findUnique({
      where: { slug: params.slug }
    })

    if (!artwork || String(artwork.artistId) !== String(currentArtistId)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!artwork || artwork.artistId !== payload.id)
      return new NextResponse('Forbidden', { status: 403 })

    const updated = await prisma.artwork.update({
      where: { slug: params.slug },
      data: {
        title: title ?? artwork.title,
        description: description ?? artwork.description,
        markupSmall:
            markupSmall !== null
            ? parseInt(markupSmall, 10) || artwork.markupSmall
            : artwork.markupSmall,
        markupMedium:
            markupMedium !== null
            ? parseInt(markupMedium, 10) || artwork.markupMedium
            : artwork.markupMedium,
        markupLarge:
            markupLarge !== null
            ? parseInt(markupLarge, 10) || artwork.markupLarge
            : artwork.markupLarge,
        imageUrl: imageUrl || artwork.imageUrl,
        },
    })

    // Delete old Cloudinary image if replaced
    if (imageUrl && artwork.imageUrl && imageUrl !== artwork.imageUrl) {
    try {
        const oldPublicId = extractPublicId(artwork.imageUrl)
        if (oldPublicId) {
        await cloudinary.uploader.destroy(oldPublicId)
        }
    } catch (err) {
        console.error("Cloudinary deletion failed:", err)
    }
    }

    const artist = await prisma.artist.findUnique({
      where: { id: updated.artistId },
      select: { slug: true },
    })

    return NextResponse.json({
      ...updated,
      artistSlug: artist?.slug,
    })
  } catch (err) {
    console.error('Editing error', err)
    return new NextResponse('Server error', { status: 500 })
  }
}