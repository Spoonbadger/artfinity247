import { NextRequest, NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma";
import {  } from '@/lib/auth'
import { jwtVerify } from 'jose'
import cloudinary from '@/lib/cloudinary'
import Busboy from 'busboy'
import { toNodeReadable } from '@/lib/toNodeReadables'

export const runtime = "nodejs"

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


    const stream = toNodeReadable(req.body as ReadableStream<any>)
    const busboy = Busboy({ headers: Object.fromEntries(req.headers) })

    const fields: Record<string, string> = {}
    let uploadedImageUrl: string | null = null

    let fileHandled = false;

    const done = new Promise<void>((resolve, reject) => {

      busboy.on('field', (name, value) => {
        fields[name] = value
      })

      busboy.on('error', reject)

    busboy.on("file", (_fieldname, file, info) => {
    fileHandled = true;

    const cloudStream = cloudinary.uploader.upload_stream(
        { folder: "artfinity", public_id: String(info?.filename || "unnamed").split(".")[0] },
        (err, result) => {
        if (err || !result) return reject(err);

        uploadedImageUrl = result.secure_url.replace("/upload/", "/upload/f_auto,q_auto/");
        return resolve();
        }
    );

    file.pipe(cloudStream);
    })

    busboy.on("finish", () => {
    // If no new file was uploaded, we still need to resolve so title/desc updates work
    if (!fileHandled) resolve();
    })

      stream.pipe(busboy)
    })

    await done

    console.log("uploadedImageUrl:", uploadedImageUrl)

    const artwork = await prisma.artwork.findUnique({
      where: { slug: params.slug }
    })
    // console.log("Artwork SLUG??: ", artwork)

    if (!artwork || String(artwork.artistId) !== String(currentArtistId)) {
      return new NextResponse('Forbidden', { status: 403 })
    }

    if (!artwork || artwork.artistId !== payload.id)
      return new NextResponse('Forbidden', { status: 403 })

    const updated = await prisma.artwork.update({
      where: { slug: params.slug },
      data: {
        title: fields.title ?? artwork.title,
        description: fields.description ?? artwork.description,
        markupSmall:
          fields.markupSmall !== undefined
            ? parseInt(fields.markupSmall, 10) || artwork.markupSmall
            : artwork.markupSmall,
        markupMedium:
          fields.markupMedium !== undefined
            ? parseInt(fields.markupMedium, 10) || artwork.markupMedium
            : artwork.markupMedium,
        markupLarge:
          fields.markupLarge !== undefined
            ? parseInt(fields.markupLarge, 10) || artwork.markupLarge
            : artwork.markupLarge,
        imageUrl: uploadedImageUrl || artwork.imageUrl,
      },
    })

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